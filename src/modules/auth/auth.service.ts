import { BadRequestException, Inject, Injectable, NotFoundException, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { LoginUseCase, defaultAuthConfig } from '@nxtlvl/auth-core';
import type { LoginCredentials } from '@nxtlvl/auth-core';
import { createHash, randomUUID } from 'crypto';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAuthRepository } from './infrastructure/prisma-auth-repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { ConsoleAuditLogger } from './infrastructure/console-audit-logger';
import { LoginDto } from './dto/login.dto';

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

    // Fetch org context not stored in JWT
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: result.user.id },
    });

    return {
      accessToken: result.session.accessToken,
      admin: {
        id: result.user.id,
        email: result.user.email,
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
    const accessToken = await tokenService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      roles: [adminUser.role],
      sessionId: randomUUID(),
    });

    return {
      accessToken,
      admin: {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        organizationId: adminUser.organizationId,
      },
    };
  }
}


