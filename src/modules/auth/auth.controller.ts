import { Body, Controller, Get, Headers, Post, UseGuards, BadRequestException } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AuthService } from './auth.service';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto, InviteAdminDto, AcceptInvitationDto, ChangePasswordDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Phase 2: Login endpoint
   * Individual account authentication with email and password
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Phase 2: Logout endpoint
   * Invalidates session (optional - depends on frontend token handling)
   */
  @Post('logout')
  @UseGuards(AdminJwtGuard)
  logout(@Headers('x-admin-id') adminId: string) {
    return this.authService.logout(adminId);
  }

  /**
   * Phase 2: Get current user info
   * Requires valid JWT token
   */
  @Get('me')
  @UseGuards(AdminJwtGuard)
  me(@Headers('x-admin-id') adminId: string) {
    return this.authService.getMe(adminId);
  }

  /**
   * Phase 2: Initiate forgot password flow
   * Sends reset email to user
   */
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.initiateForgotPassword(dto.email);
  }

  /**
   * Phase 2: Reset password with token
   * Completes forgot password flow
   */
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }

  /**
   * Phase 2: Change password (authenticated user)
   * User changes their own password
   */
  @Post('change-password')
  @UseGuards(AdminJwtGuard)
  changePassword(@Headers('x-admin-id') adminId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(adminId, dto.currentPassword, dto.newPassword);
  }

  /**
   * Phase 2: Send admin invitation email
   * Org admin or super admin invites new team member
   * Requires AdminJwtGuard
   */
  @Post('invite-admin')
  @UseGuards(AdminJwtGuard)
  inviteAdmin(@Headers('x-admin-id') adminId: string, @Body() dto: InviteAdminDto) {
    return this.authService.sendAdminInvitation(adminId, dto);
  }

  /**
   * Phase 2: Accept admin invitation
   * New user accepts invitation and sets their password
   */
  @Post('accept-invitation')
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.authService.acceptAdminInvitation(dto.invitationToken, dto.password);
  }

  /**
   * Phase 2: Check if user exists
   * Used by frontend to verify email during signup/invitation flow
   */
  @Post('check-email')
  checkEmailExists(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    return this.authService.checkEmailExists(body.email);
  }

  /**
   * Phase 2: Verify email token
   * Confirms email ownership for account activation
   */
  @Post('verify-email')
  verifyEmail(@Body() body: { token: string }) {
    if (!body.token) {
      throw new BadRequestException('Verification token is required');
    }
    return this.authService.verifyEmailToken(body.token);
  }

  /**
   * Phase 2: Resend verification email
   * User can request new verification email
   */
  @Post('resend-verification-email')
  resendVerificationEmail(@Body() body: { email: string }) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    return this.authService.resendVerificationEmail(body.email);
  }

  /**
   * Phase 2: Get user session status
   * Check if current session is still valid
   */
  @Get('session-status')
  @UseGuards(AdminJwtGuard)
  getSessionStatus(@Headers('x-admin-id') adminId: string) {
    return this.authService.getSessionStatus(adminId);
  }

  /**
   * Phase 2: Disable user account
   * Admin action to disable a user (soft delete)
   */
  @Post('disable-user/:userId')
  @UseGuards(AdminJwtGuard)
  disableUser(@Headers('x-admin-id') adminId: string, @Headers('x-user-id') userId: string) {
    return this.authService.disableUser(adminId, userId);
  }

  /**
   * Phase 2: Enable user account
   * Admin action to re-enable a disabled user
   */
  @Post('enable-user/:userId')
  @UseGuards(AdminJwtGuard)
  enableUser(@Headers('x-admin-id') adminId: string, @Headers('x-user-id') userId: string) {
    return this.authService.enableUser(adminId, userId);
  }
}
