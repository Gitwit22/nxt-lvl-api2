import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EnhancedJwtTokenService } from './services/enhanced-jwt-token.service';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    EnhancedJwtTokenService,
    AdminJwtGuard,
  ],
  exports: [AuthService, EnhancedJwtTokenService, AdminJwtGuard],
})
export class AuthModule {}

