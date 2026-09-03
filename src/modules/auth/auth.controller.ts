import { Body, Controller, Get, Patch, Post, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AuthService } from './auth.service';
import {
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
} from './auth-cookies';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return { admin: result.admin };
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('Missing refresh session.');
    const result = await this.authService.refresh(refreshToken);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return { valid: true };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    clearAuthCookies(response);
    return this.authService.logout(refreshToken);
  }

  @Get('me')
  @UseGuards(AdminJwtGuard)
  getMe(@Req() req: Request) {
    const adminId = req.headers['x-admin-id'] as string;
    return this.authService.getMe(adminId);
  }

  @Patch('me')
  @UseGuards(AdminJwtGuard)
  updateMe(@Req() req: Request, @Body() dto: UpdateProfileDto) {
    const adminId = req.headers['x-admin-id'] as string;
    return this.authService.updateMe(adminId, dto);
  }

  @Post('change-password')
  @UseGuards(AdminJwtGuard)
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const adminId = req.headers['x-admin-id'] as string;
    const result = await this.authService.changePassword(adminId, dto);
    clearAuthCookies(response);
    return result;
  }

  @Get('session')
  @UseGuards(AdminJwtGuard)
  getSession() {
    return { valid: true };
  }

  @Get('validate-invite')
  validateInvite(@Query('token') token: string) {
    return this.authService.validateInvite(token);
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body() body: { token: string; newPassword: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.acceptInvite(body.token, body.newPassword);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    return { admin: result.admin };
  }
}
