import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import type { AccessClaims } from './services/enhanced-jwt-token.service';
import { AuthService } from './auth.service';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/auth.dto';

const ACCESS_COOKIE = '__Host-clientflow_access';
const REFRESH_COOKIE = '__Host-clientflow_refresh';

function cookieOptions(isProduction: boolean, maxAge: number, path = '/'): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path,
    maxAge: maxAge * 1000, // express uses milliseconds
  };
}

@Controller('auth')
export class AuthController {
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(private readonly authService: AuthService) {}

  /** POST /auth/login — validate credentials, create session, set HttpOnly cookies */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res() res: Response) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
      ?? req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    const result = await this.authService.login(dto, ip, ua);

    res.cookie(ACCESS_COOKIE, result.tokens.accessToken,
      cookieOptions(this.isProduction, result.tokens.expiresIn));

    res.cookie(REFRESH_COOKIE, result.tokens.refreshToken,
      cookieOptions(this.isProduction, 7 * 24 * 60 * 60, '/api/v1/auth/refresh'));

    return res.json({ admin: result.admin });
  }

  /** POST /auth/refresh — rotate refresh token, issue new access token via cookie */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req.cookies as Record<string, string | undefined>)?.[REFRESH_COOKIE];
    if (!refreshToken) throw new BadRequestException('No refresh token provided.');

    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
      ?? req.socket.remoteAddress;
    const ua = req.headers['user-agent'];

    const tokens = await this.authService.refreshSession(refreshToken, ip, ua);

    res.cookie(ACCESS_COOKIE, tokens.accessToken,
      cookieOptions(this.isProduction, tokens.expiresIn));

    res.cookie(REFRESH_COOKIE, tokens.refreshToken,
      cookieOptions(this.isProduction, 7 * 24 * 60 * 60, '/api/v1/auth/refresh'));

    return res.json({ ok: true });
  }

  /** POST /auth/logout — revoke session, clear cookies */
  @Post('logout')
  @UseGuards(AdminJwtGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request & { sessionId?: string }, @Res() res: Response) {
    if (req.sessionId) {
      await this.authService.logout(req.sessionId);
    }

    res.clearCookie(ACCESS_COOKIE, { path: '/', secure: this.isProduction, sameSite: 'lax' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth/refresh', secure: this.isProduction, sameSite: 'lax' });

    return res.json({ message: 'Logged out successfully.' });
  }

  /**
   * GET /auth/session — lightweight check: is the token + DB session still valid?
   * Returns 401 if the guard rejects; returns { valid: true } if it passes.
   */
  @Get('session')
  @UseGuards(AdminJwtGuard)
  getSession(@Req() req: Request & { adminUser?: AccessClaims }) {
    return this.authService.getSession(req.adminUser!.adminId);
  }

  /**
   * GET /auth/bootstrap — primary frontend startup endpoint.
   * Returns user context, active organization, settings, and resolved permissions.
   * Never reads org/permissions from frontend storage — all resolved server-side.
   */
  @Get('bootstrap')
  @UseGuards(AdminJwtGuard)
  bootstrap(@Req() req: Request & { adminUser?: AccessClaims }) {
    return this.authService.bootstrap(req.adminUser!.adminId);
  }

  /** POST /auth/change-password — revokes all sessions after success */
  @Post('change-password')
  @UseGuards(AdminJwtGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: Request & { adminUser?: AccessClaims },
    @Body() dto: ChangePasswordDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.changePassword(req.adminUser!.adminId, dto);

    // Clear cookies — user must log in again
    res.clearCookie(ACCESS_COOKIE, { path: '/', secure: this.isProduction, sameSite: 'lax' });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth/refresh', secure: this.isProduction, sameSite: 'lax' });

    return res.json(result);
  }

  /** POST /auth/forgot-password */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.initiateForgotPassword(dto.email);
  }

  /** POST /auth/reset-password */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.resetToken, dto.newPassword);
  }
}
