import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaAuthRepository } from './infrastructure/prisma-auth-repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { ConsoleAuditLogger } from './infrastructure/console-audit-logger';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaAuthRepository,
    BcryptPasswordHasher,
    JwtTokenService,
    ConsoleAuditLogger,
  ],
  exports: [AuthService],
})
export class AuthModule {}

