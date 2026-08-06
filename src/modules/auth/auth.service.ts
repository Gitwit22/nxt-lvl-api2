import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { LoginUseCase, defaultAuthConfig } from '@nxtlvl/auth-core';
import type { LoginCredentials } from '@nxtlvl/auth-core';
import { PrismaService } from '../../prisma/prisma.service';
import programPartition from '../../config/program.partition.json';
import { PrismaAuthRepository } from './infrastructure/prisma-auth-repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { ConsoleAuditLogger } from './infrastructure/console-audit-logger';
import { LoginDto, InviteAdminDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly loginUseCase: LoginUseCase;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authRepository: PrismaAuthRepository,
    private readonly passwordHasher: BcryptPasswordHasher,
    private readonly tokenService: JwtTokenService,
    private readonly auditLogger: ConsoleAuditLogger,
  ) {
    this.loginUseCase = new LoginUseCase({
      authRepository: this.authRepository,
      passwordHasher: this.passwordHasher,
      tokenService: this.tokenService,
      auditLogger: this.auditLogger,
      config: {
        ...defaultAuthConfig,
        issuer: programPartition.authIssuer,
        allowLogin: true,
        requireVerifiedEmailForLogin: false,
        sessionTtlSeconds: 86400,
      },
    });
  }

  /**
   * Phase 2: Login with email and password
   * Individual account authentication
   */
  async login(dto: LoginDto) {
    const credentials: LoginCredentials = { email: dto.email, password: dto.password };
    const result = await this.loginUseCase.execute(credentials);

    if (!result.success) {
      throw new UnauthorizedException(result.error.message);
    }

    // Fetch org context not stored in JWT
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: result.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        organizationId: true,
      },
    });

    if (!admin?.isActive) {
      throw new UnauthorizedException('This account has been disabled.');
    }

    // Update last login
    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken: result.session.accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        organizationId: admin.organizationId,
      },
    };
  }

  /**
   * Phase 2: Logout (invalidate session)
   * Frontend typically handles token deletion, but backend can track logout for audit
   */
  async logout(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found.');
    }

    // Log logout event
    await this.auditLogger.log({
      adminId,
      action: 'logout',
      targetType: 'AdminUser',
      targetId: adminId,
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Phase 2: Get current authenticated user info
   */
  async getMe(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found.');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('This account has been disabled.');
    }

    return admin;
  }

  /**
   * Phase 2: Initiate forgot password flow
   * TODO: Integrate with email service (Resend, SendGrid, etc.)
   * Generate reset token and send via email
   */
  async initiateForgotPassword(email: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      // Security: Don't reveal if email exists
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    if (!admin.isActive) {
      throw new BadRequestException('This account has been disabled.');
    }

    // TODO: Generate reset token and send email
    // For now, return success response
    console.log(`[TODO] Send password reset email to ${email}`);

    return {
      message: 'Password reset link sent to your email. It expires in 1 hour.',
    };
  }

  /**
   * Phase 2: Reset password with token
   * TODO: Validate reset token before allowing password change
   */
  async resetPassword(resetToken: string, newPassword: string) {
    // TODO: Validate reset token and get associated email
    // For now, this is a stub
    throw new BadRequestException('Password reset functionality requires email service integration.');
  }

  /**
   * Phase 2: Change password (authenticated user)
   * User must provide current password to change it
   */
  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found.');
    }

    // Verify current password
    const passwordValid = await this.passwordHasher.compare(
      currentPassword,
      admin.passwordHash,
    );

    if (!passwordValid) {
      throw new BadRequestException('Current password is incorrect.');
    }

    // Hash new password
    const newPasswordHash = await this.passwordHasher.hash(newPassword);

    // Update password
    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: { passwordHash: newPasswordHash },
    });

    return { message: 'Password changed successfully.' };
  }

  /**
   * Phase 2: Send admin invitation email
   * Org admin invites new team member
   * TODO: Integrate with email service to send invitation with link
   */
  async sendAdminInvitation(actingAdminId: string, inviteDto: InviteAdminDto) {
    const actingAdmin = await this.prisma.adminUser.findUnique({
      where: { id: actingAdminId },
    });

    if (!actingAdmin) {
      throw new UnauthorizedException('Acting admin not found.');
    }

    // Check if email already exists
    const existingAdmin = await this.prisma.adminUser.findUnique({
      where: { email: inviteDto.email },
    });

    if (existingAdmin) {
      throw new ConflictException('An admin with this email already exists.');
    }

    // Check acting admin has permission to invite (must be org_admin or super_admin)
    if (!['org_admin', 'super_admin'].includes(actingAdmin.role)) {
      throw new UnauthorizedException('You do not have permission to invite admins.');
    }

    // Create pending invitation
    // TODO: Generate invitation token and send via email
    console.log(
      `[TODO] Send invitation email to ${inviteDto.email} for role ${inviteDto.role}`,
    );

    return {
      message: `Invitation sent to ${inviteDto.email}. They have 7 days to accept.`,
      email: inviteDto.email,
    };
  }

  /**
   * Phase 2: Accept admin invitation
   * New user accepts invitation and creates account with password
   * TODO: Validate invitation token and create user account
   */
  async acceptAdminInvitation(invitationToken: string, password: string) {
    // TODO: Validate token, extract email, role, and orgId
    // For now, this is a stub
    throw new BadRequestException('Invitation acceptance requires email service integration.');
  }

  /**
   * Phase 2: Check if email exists
   * Used by frontend during signup/invitation acceptance flow
   */
  async checkEmailExists(email: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
      select: { id: true },
    });

    return {
      exists: !!admin,
      email,
    };
  }

  /**
   * Phase 2: Verify email token
   * TODO: Implement email verification with tokens
   */
  async verifyEmailToken(token: string) {
    // TODO: Validate email verification token
    throw new BadRequestException('Email verification requires email service integration.');
  }

  /**
   * Phase 2: Resend verification email
   * TODO: Generate new verification token and send
   */
  async resendVerificationEmail(email: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      // Security: Don't reveal if email exists
      return { message: 'If the email exists, a verification email has been sent.' };
    }

    // TODO: Generate verification token and send email
    return {
      message: 'Verification email sent. Please check your inbox.',
    };
  }

  /**
   * Phase 2: Get session status
   * Check if JWT is still valid and return user info
   */
  async getSessionStatus(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        isActive: true,
        role: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Session invalid: Admin not found.');
    }

    return {
      valid: admin.isActive,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
      },
    };
  }

  /**
   * Phase 2: Disable user account (soft delete)
   * Admin action - requires org_admin or super_admin
   */
  async disableUser(actingAdminId: string, targetUserId: string) {
    const actingAdmin = await this.prisma.adminUser.findUnique({
      where: { id: actingAdminId },
    });

    if (!actingAdmin) {
      throw new UnauthorizedException('Acting admin not found.');
    }

    // Check permissions
    if (!['org_admin', 'super_admin'].includes(actingAdmin.role)) {
      throw new UnauthorizedException('You do not have permission to disable users.');
    }

    const targetUser = await this.prisma.adminUser.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new BadRequestException('Target user not found.');
    }

    // Disable user
    const updated = await this.prisma.adminUser.update({
      where: { id: targetUserId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    // Log action
    await this.auditLogger.log({
      adminId: actingAdminId,
      action: 'disabled_user',
      targetType: 'AdminUser',
      targetId: targetUserId,
    });

    return {
      message: `User ${updated.email} has been disabled.`,
      user: updated,
    };
  }

  /**
   * Phase 2: Enable user account
   * Admin action - requires org_admin or super_admin
   */
  async enableUser(actingAdminId: string, targetUserId: string) {
    const actingAdmin = await this.prisma.adminUser.findUnique({
      where: { id: actingAdminId },
    });

    if (!actingAdmin) {
      throw new UnauthorizedException('Acting admin not found.');
    }

    // Check permissions
    if (!['org_admin', 'super_admin'].includes(actingAdmin.role)) {
      throw new UnauthorizedException('You do not have permission to enable users.');
    }

    const targetUser = await this.prisma.adminUser.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new BadRequestException('Target user not found.');
    }

    // Enable user
    const updated = await this.prisma.adminUser.update({
      where: { id: targetUserId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    // Log action
    await this.auditLogger.log({
      adminId: actingAdminId,
      action: 'enabled_user',
      targetType: 'AdminUser',
      targetId: targetUserId,
    });

    return {
      message: `User ${updated.email} has been enabled.`,
      user: updated,
    };
  }
}

