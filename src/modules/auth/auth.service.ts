import { BadRequestException, Inject, Injectable, NotFoundException, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { LoginUseCase, defaultAuthConfig } from '@nxtlvl/auth-core';
import type { LoginCredentials } from '@nxtlvl/auth-core';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { decode, sign } from 'jsonwebtoken';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAuthRepository } from './infrastructure/prisma-auth-repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { ConsoleAuditLogger } from './infrastructure/console-audit-logger';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type IssuedSession = {
  accessToken: string;
  refreshToken: string;
};

@Injectable({ scope: Scope.REQUEST })
export class AuthService {
  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: PrismaService,
    private readonly authRepository: PrismaAuthRepository,
    private readonly passwordHasher: BcryptPasswordHasher,
    private readonly auditLogger: ConsoleAuditLogger,
  ) {}

  async login(dto: LoginDto) {
    const tokenService = new JwtTokenService(this.request.partition.authIssuer);
    const loginUseCase = new LoginUseCase({
      authRepository: this.authRepository,
      passwordHasher: this.passwordHasher,
      tokenService,
      auditLogger: this.auditLogger,
      config: {
        ...defaultAuthConfig,
        issuer: this.request.partition.authIssuer,
        allowLogin: true,
        requireVerifiedEmailForLogin: false,
        sessionTtlSeconds: 86400,
      },
    });
    const credentials: LoginCredentials = { email: dto.email, password: dto.password };
    const result = await loginUseCase.execute(credentials);

    if (!result.success) {
      throw new UnauthorizedException(result.error.message);
    }

    // Fetch org context to embed in JWT
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: result.user.id },
      select: {
        organizationId: true,
        firstName: true,
        lastName: true,
      },
    });

    const session = await this.issueSessionToken(
      result.user.id,
      result.user.email,
      result.user.roles as string[],
      admin?.organizationId,
    );

    return {
      ...session,
      admin: {
        id: result.user.id,
        email: result.user.email,
        firstName: admin?.firstName,
        lastName: admin?.lastName,
        jobTitle: null,
        role: result.user.roles[0] ?? 'reviewer',
        organizationId: admin?.organizationId,
      },
    };
  }

  async validateInvite(token: string): Promise<{ valid: boolean; email?: string; firstName?: string; reason?: string }> {
    if (!token) return { valid: false, reason: 'Missing token.' };

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { tokenHash },
      include: { adminUser: { select: { email: true, firstName: true } } },
    });

    if (!invitation) return { valid: false, reason: 'Invitation not found.' };
    if (invitation.acceptedAt) return { valid: false, reason: 'Invitation already accepted.' };
    if (invitation.revokedAt) return { valid: false, reason: 'Invitation has been revoked.' };
    if (invitation.expiresAt < new Date()) return { valid: false, reason: 'Invitation has expired.' };

    return {
      valid: true,
      email: invitation.adminUser.email,
      firstName: invitation.adminUser.firstName ?? undefined,
    };
  }

  async acceptInvite(token: string, newPassword: string) {
    if (!token || !newPassword) throw new BadRequestException('Token and new password are required.');
    if (newPassword.length < 8) throw new BadRequestException('Password must be at least 8 characters.');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { tokenHash },
      include: { adminUser: true },
    });

    if (!invitation) throw new NotFoundException('Invitation not found.');
    if (invitation.acceptedAt) throw new BadRequestException('Invitation already accepted.');
    if (invitation.revokedAt) throw new BadRequestException('Invitation has been revoked.');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation has expired. Ask your admin to resend the invite.');

    const passwordHash = await this.passwordHasher.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: invitation.adminUserId },
        data: { passwordHash, isActive: true },
      }),
      this.prisma.adminInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    const { adminUser } = invitation;
    const tokenService = new JwtTokenService(this.request.partition.authIssuer);
    const session = await this.issueSessionToken(
      adminUser.id,
      adminUser.email,
      [adminUser.role],
      adminUser.organizationId,
    );

    return {
      ...session,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        jobTitle: adminUser.jobTitle,
        role: adminUser.role,
        organizationId: adminUser.organizationId,
      },
    };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, firstName: true, lastName: true, jobTitle: true, role: true, organizationId: true, isActive: true },
    });
    if (!admin) throw new NotFoundException('User not found.');
    return admin;
  }

  async updateMe(adminId: string, dto: UpdateProfileDto) {
    const normalize = (value: string | undefined) =>
      value === undefined ? undefined : value.trim() || null;

    return this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        firstName: normalize(dto.firstName),
        lastName: normalize(dto.lastName),
        jobTitle: normalize(dto.jobTitle),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        role: true,
        organizationId: true,
        isActive: true,
      },
    });
  }

  async changePassword(adminId: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { passwordHash: true },
    });
    if (!admin) throw new NotFoundException('User not found.');

    const currentPasswordValid = await this.passwordHasher.compare(
      dto.currentPassword,
      admin.passwordHash,
    );
    if (!currentPasswordValid) throw new UnauthorizedException('Current password is incorrect.');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const passwordHash = await this.passwordHasher.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash } }),
      this.prisma.authSession.updateMany({
        where: { adminUserId: adminId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password changed. Sign in again with your new password.' };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return { message: 'Logged out.' };
    const [sessionId, secret] = refreshToken.split('.', 2);
    if (!sessionId || !secret) return { message: 'Logged out.' };
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out.' };
  }

  async refresh(refreshToken: string): Promise<IssuedSession> {
    const [sessionId, secret] = refreshToken.split('.', 2);
    if (!sessionId || !secret) throw new UnauthorizedException('Invalid refresh session.');

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        refreshTokenHash,
        refreshExpiresAt: { gt: new Date() },
        revokedAt: null,
        adminUser: { isActive: true },
      },
      include: { adminUser: true },
    });
    if (!session) throw new UnauthorizedException('Refresh session is expired or revoked.');

    const nextJti = randomUUID();
    const nextRefreshToken = this.createRefreshToken(session.id);
    const nextRefreshTokenHash = this.hashRefreshToken(nextRefreshToken);
    const rotated = await this.prisma.authSession.updateMany({
      where: { id: session.id, refreshTokenHash, revokedAt: null },
      data: {
        jti: nextJti,
        refreshTokenHash: nextRefreshTokenHash,
        refreshRotatedAt: new Date(),
      },
    });
    if (rotated.count !== 1) throw new UnauthorizedException('Refresh session was already used.');

    return {
      accessToken: this.signWithOrgId(
        session.adminUser.id,
        session.adminUser.email,
        [session.adminUser.role],
        session.adminUser.organizationId,
        session.id,
        nextJti,
      ),
      refreshToken: nextRefreshToken,
    };
  }

  private async issueSessionToken(
    sub: string,
    email: string,
    roles: string[],
    organizationId?: string,
  ): Promise<IssuedSession> {
    const sessionId = randomUUID();
    const jti = randomUUID();
    const token = this.signWithOrgId(sub, email, roles, organizationId, sessionId, jti);
    const payload = decode(token) as { exp?: number } | null;
    if (!payload?.exp) throw new UnauthorizedException('Could not create an authenticated session.');
    const refreshToken = this.createRefreshToken(sessionId);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        adminUserId: sub,
        jti,
        expiresAt: refreshExpiresAt,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        refreshExpiresAt,
      },
    });
    return { accessToken: token, refreshToken };
  }

  private createRefreshToken(sessionId: string): string {
    return `${sessionId}.${randomBytes(32).toString('base64url')}`;
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private signWithOrgId(
    sub: string,
    email: string,
    roles: string[],
    organizationId?: string,
    sessionId: string = randomUUID(),
    jti: string = randomUUID(),
  ): string {
    const secret = process.env['JWT_SECRET'] ?? '';
    const expiresIn = (process.env['JWT_ACCESS_EXPIRES_IN'] ?? '15m') as unknown as number;
    return sign(
      { email, roles, sessionId, jti, organizationId },
      secret,
      { subject: sub, expiresIn, issuer: this.request.partition.authIssuer },
    );
  }
}


