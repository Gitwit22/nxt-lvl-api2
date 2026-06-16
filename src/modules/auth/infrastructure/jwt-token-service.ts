import { Injectable } from '@nestjs/common';
import { sign, verify as jwtVerify } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { AuthErrorCode, createAuthError } from '@nxtlvl/auth-core';
import type { SignTokenInput, TokenPayload, TokenService } from '@nxtlvl/auth-core';

@Injectable()
export class JwtTokenService implements TokenService {
  private get secret(): string {
    return process.env['JWT_SECRET'] ?? '';
  }

  private get expiresIn(): string {
    return process.env['JWT_EXPIRES_IN'] ?? '1d';
  }

  async sign(input: SignTokenInput): Promise<string> {
    return sign(
      {
        email: input.email,
        roles: input.roles,
        sessionId: input.sessionId,
        jti: randomUUID(),
      },
      this.secret,
      { subject: input.sub, expiresIn: this.expiresIn as unknown as number },
    );
  }

  async verify(token: string): Promise<TokenPayload> {
    try {
      return jwtVerify(token, this.secret) as TokenPayload;
    } catch {
      throw createAuthError(AuthErrorCode.TOKEN_INVALID, 'Invalid or expired token.');
    }
  }

  async refresh(_refreshToken: string): Promise<string> {
    throw createAuthError(AuthErrorCode.TOKEN_INVALID, 'Refresh tokens not implemented.');
  }

  async revoke(_jti: string): Promise<void> {
    // Stateless JWT — revocation not implemented
  }
}
