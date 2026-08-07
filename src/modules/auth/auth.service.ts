import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { compare as bcryptCompare, hash as bcryptHash } from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { EnhancedJwtTokenService, CreateSessionInput } from './services/enhanced-jwt-token.service';
import { LoginDto, ChangePasswordDto } from './dto/auth.dto';
import { PlatformRole } from '../../common/types/roles';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: EnhancedJwtTokenService,
  ) {}

  // ─── Login / Session ────────────────────────────────────────────────────────

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email.toLowerCase().trim() } });

    // Constant-time: always hash-compare even if user missing to prevent timing attacks
    const dummyHash = '$2b$10$dummyhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn';
    const passwordValid = await bcryptCompare(dto.password, admin?.passwordHash ?? dummyHash);

    if (!admin || !passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!admin.isActive) {
      throw new UnauthorizedException('This account has been disabled.');
    }

    // Resolve primary organization membership
    const membership = await this.prisma.organizationMember.findFirst({
      where: { adminUserId: admin.id, isActive: true },
      include: { organization: { select: { id: true, name: true, slug: true, status: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    const input: CreateSessionInput = {
      adminId: admin.id,
      email: admin.email,
      platformRole: admin.platformRole ?? undefined,
      organizationId: membership?.organizationId,
      organizationRole: membership?.organizationRole,
    };

    const { tokens, sessionId } = await this.tokenService.createSession(input, ipAddress, userAgent);

    await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    return {
      tokens,
      sessionId,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        platformRole: admin.platformRole,
        activeOrganization: membership
          ? {
              id: membership.organization.id,
              name: membership.organization.name,
              role: membership.organizationRole,
              status: membership.organization.status,
            }
          : null,
      },
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.tokenService.revokeSession(sessionId);
  }

  async refreshSession(refreshToken: string, ipAddress?: string, userAgent?: string) {
    return this.tokenService.rotateRefreshToken(refreshToken, ipAddress, userAgent);
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────────────

  async bootstrap(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      include: {
        organizationMembers: {
          where: { isActive: true },
          include: {
            organization: { select: { id: true, name: true, slug: true, status: true, settings: true } },
          },
          orderBy: { joinedAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!admin || !admin.isActive) throw new UnauthorizedException('Account not found or disabled.');

    const membership = admin.organizationMembers[0];
    const org = membership?.organization;
    const settings = (org?.settings as Record<string, unknown>) ?? {};

    const isPlatformAdmin = admin.platformRole === PlatformRole.PLATFORM_SUPER_ADMIN;

    const permissions = this.resolvePermissions(isPlatformAdmin, membership?.organizationRole);

    return {
      user: {
        id: admin.id,
        email: admin.email,
        displayName: [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.email,
      },
      platformRole: admin.platformRole ?? null,
      activeOrganization: org
        ? {
            id: org.id,
            name: org.name,
            role: membership?.organizationRole ?? null,
            status: org.status,
          }
        : null,
      settings: {
        timezone: (settings['timezone'] as string) ?? 'America/Detroit',
        currency: (settings['currency'] as string) ?? 'USD',
        environment: process.env.NODE_ENV ?? 'development',
        features: (settings['features'] as Record<string, boolean>) ?? {
          fundingPrograms: true,
          documentManagement: true,
          financialTracking: true,
          communications: true,
        },
      },
      permissions,
    };
  }

  // ─── Password management ────────────────────────────────────────────────────

  async changePassword(adminId: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException('Account not found.');

    const valid = await bcryptCompare(dto.currentPassword, admin.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect.');

    const newHash = await bcryptHash(dto.newPassword, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.adminUser.update({
        where: { id: adminId },
        data: { passwordHash: newHash, passwordChangedAt: new Date() },
      });
      // Revoke all active sessions — user must log in again
      await tx.session.updateMany({
        where: { adminUserId: adminId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Password changed. Please log in again.' };
  }

  async initiateForgotPassword(email: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    // Always return the same message to avoid user enumeration
    if (!admin || !admin.isActive) {
      return { message: 'If that email is registered, a reset link has been sent.' };
    }
    // TODO: generate reset token and send via email service
    console.log(`[TODO] Send password reset email to ${email}`);
    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  async resetPassword(_resetToken: string, _newPassword: string) {
    throw new BadRequestException('Password reset requires email service integration.');
  }

  // ─── Session endpoint ───────────────────────────────────────────────────────

  async getSession(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, isActive: true, platformRole: true },
    });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Session invalid.');
    return { valid: true, admin };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private resolvePermissions(isPlatformAdmin: boolean, orgRole?: string): string[] {
    if (isPlatformAdmin) {
      return [
        'platform.admin',
        'organization.read',
        'organization.update',
        'members.manage',
        'clients.read',
        'clients.update',
        'programs.manage',
        'funding.manage',
        'documents.manage',
      ];
    }
    if (orgRole === 'org_owner') {
      return [
        'organization.read',
        'organization.update',
        'members.manage',
        'clients.read',
        'clients.update',
        'programs.manage',
        'funding.manage',
        'documents.manage',
      ];
    }
    if (orgRole === 'org_admin') {
      return [
        'organization.read',
        'members.manage',
        'clients.read',
        'clients.update',
        'programs.manage',
        'documents.manage',
      ];
    }
    // reviewer
    return ['organization.read', 'clients.read'];
  }
}
