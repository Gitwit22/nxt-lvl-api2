import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginUseCase, defaultAuthConfig } from '@nxtlvl/auth-core';
import type { LoginCredentials } from '@nxtlvl/auth-core';
import { PrismaService } from '../../prisma/prisma.service';
import programPartition from '../../config/program.partition.json';
import { PrismaAuthRepository } from './infrastructure/prisma-auth-repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { ConsoleAuditLogger } from './infrastructure/console-audit-logger';
import { LoginDto } from './dto/login.dto';

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

  async login(dto: LoginDto) {
    const credentials: LoginCredentials = { email: dto.email, password: dto.password };
    const result = await this.loginUseCase.execute(credentials);

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

  async getMe(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    });
    if (!admin) throw new UnauthorizedException('Admin not found.');
    return admin;
  }
}

