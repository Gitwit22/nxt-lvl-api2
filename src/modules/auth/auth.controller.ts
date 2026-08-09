import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @UseGuards(AdminJwtGuard)
  logout() {
    return { message: 'Logged out.' };
  }

  @Get('validate-invite')
  validateInvite(@Query('token') token: string) {
    return this.authService.validateInvite(token);
  }

  @Post('accept-invite')
  acceptInvite(@Body() body: { token: string; newPassword: string }) {
    return this.authService.acceptInvite(body.token, body.newPassword);
  }
}
