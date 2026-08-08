import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { LoginUseCase, defaultAuthConfig } from '@nxtlvl/auth-core';
import type { LoginCredentials } from '@nxtlvl/auth-core';
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
}

