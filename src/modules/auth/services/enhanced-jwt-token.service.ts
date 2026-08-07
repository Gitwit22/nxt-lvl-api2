import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify as jwtVerify } from 'jsonwebtoken';
import { hash as bcryptHash, compare as bcryptCompare } from 'bcrypt';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  JwtPayload,
  TokenResponse,
  TokenType,
  TokenConfig,
  DEFAULT_TOKEN_CONFIG,
} from '../../../common/types/jwt';
import { randomBytes, randomUUID } from 'crypto';

export interface CreateSessionInput {
  adminId: string;
  email: string;
  platformRole?: string;
  organizationId?: string;
  organizationRole?: string;
}

export interface AccessClaims {
  adminId: string;
  email: string;
  platformRole?: string;
  organizationId?: string;
  organizationRole?: string;
  jti: string;
  sessionId: string;
}

/**
 * Enhanced JWT Token Service
 *
 * - Access token (short-lived: 30 minutes)
 * - Refresh token (7 days), stored as bcrypt hash — never plaintext
 * - Token rotation with reuse detection via tokenFamily
 * - Session revocation on logout / password-change / account-disable
 */
@Injectable()
export class EnhancedJwtTokenService {
  private readonly config: TokenConfig;
  private get jwtSecret(): string {
    const s = this.configService.get<string>('JWT_SECRET');
    if (!s) throw new Error('JWT_SECRET env var is not set');
    return s;
  }

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.config = {
      issuer: this.configService.get('JWT_ISSUER', DEFAULT_TOKEN_CONFIG.issuer),
      audience: this.configService.get('JWT_AUDIENCE', DEFAULT_TOKEN_CONFIG.audience),
      accessTokenExpiresIn: parseInt(
        this.configService.get('JWT_ACCESS_EXPIRES_IN', String(DEFAULT_TOKEN_CONFIG.accessTokenExpiresIn)),
      ),
      refreshTokenExpiresIn: parseInt(
        this.configService.get('JWT_REFRESH_EXPIRES_IN', String(DEFAULT_TOKEN_CONFIG.refreshTokenExpiresIn)),
      ),
      algorithm: 'HS256',
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private sign(payload: JwtPayload): string {
    return sign(payload as object, this.jwtSecret, {
      algorithm: 'HS256',
      // exp is already embedded in payload; jsonwebtoken will not override it
      // if we pass `expiresIn` here, but we carry it explicitly to keep full control.
    });
  }

  private verify(token: string): JwtPayload {
    return jwtVerify(token, this.jwtSecret, {
      algorithms: ['HS256'],
    }) as unknown as JwtPayload;
  }

  private buildAccessPayload(input: CreateSessionInput, jti: string): JwtPayload {
    const now = Math.floor(Date.now() / 1000);
    return {
      alg: 'HS256',
      iss: this.config.issuer,
      aud: this.config.audience,
      sub: input.adminId,
      exp: now + this.config.accessTokenExpiresIn,
      iat: now,
      jti,
      type: TokenType.ACCESS,
      adminId: input.adminId,
      email: input.email,
      platformRole: input.platformRole,
      organizationId: input.organizationId,
      organizationRole: input.organizationRole,
    };
  }

  private buildRefreshPayload(input: CreateSessionInput, jti: string): JwtPayload {
    const now = Math.floor(Date.now() / 1000);
    return {
      alg: 'HS256',
      iss: this.config.issuer,
      aud: this.config.audience,
      sub: input.adminId,
      exp: now + this.config.refreshTokenExpiresIn,
      iat: now,
      jti,
      type: TokenType.REFRESH,
      adminId: input.adminId,
      email: input.email,
    };
  }

  private validateClaims(payload: JwtPayload): void {
    const now = Math.floor(Date.now() / 1000);
    if (payload.alg !== 'HS256') throw new UnauthorizedException('Invalid algorithm');
    if (payload.iss !== this.config.issuer) throw new UnauthorizedException('Invalid issuer');
    if (payload.aud !== this.config.audience) throw new UnauthorizedException('Invalid audience');
    if (!payload.sub) throw new UnauthorizedException('Missing subject');
    if (!payload.exp || payload.exp < now) throw new UnauthorizedException('Token expired');
    if (!payload.iat || payload.iat > now + 5) throw new UnauthorizedException('Invalid iat');
    if (!payload.jti) throw new UnauthorizedException('Missing jti');
    if (![TokenType.ACCESS, TokenType.REFRESH].includes(payload.type)) {
      throw new UnauthorizedException('Invalid token type');
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Create a new session: issue access + refresh tokens, persist session.
   */
  async createSession(
    input: CreateSessionInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ tokens: TokenResponse; sessionId: string }> {
    const jti = randomBytes(16).toString('hex');
    const tokenFamily = randomUUID(); // identifies this rotation chain

    const accessToken = this.sign(this.buildAccessPayload(input, jti));
    const refreshToken = this.sign(this.buildRefreshPayload(input, jti));
    const refreshTokenHash = await bcryptHash(refreshToken, 10);

    const now = Date.now();
    const session = await this.prisma.session.create({
      data: {
        adminUserId: input.adminId,
        jti,
        tokenFamily,
        refreshTokenHash,
        accessExpiresAt: new Date(now + this.config.accessTokenExpiresIn * 1000),
        refreshExpiresAt: new Date(now + this.config.refreshTokenExpiresIn * 1000),
        ipAddress,
        userAgent,
      },
    });

    return {
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.config.accessTokenExpiresIn,
        tokenType: 'Bearer',
      },
      sessionId: session.id,
    };
  }

  /**
   * Verify an access token, check DB session is not revoked.
   * Returns claims including the session DB id.
   */
  async verifyAccessToken(token: string): Promise<AccessClaims> {
    let payload: JwtPayload;
    try {
      payload = this.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    this.validateClaims(payload);
    if (payload.type !== TokenType.ACCESS) throw new UnauthorizedException('Wrong token type');

    const session = await this.prisma.session.findUnique({ where: { jti: payload.jti } });
    if (!session || session.revokedAt) throw new UnauthorizedException('Session revoked');
    if (session.accessExpiresAt < new Date()) throw new UnauthorizedException('Session expired');

    return {
      adminId: payload.adminId,
      email: payload.email,
      platformRole: payload.platformRole,
      organizationId: payload.organizationId,
      organizationRole: payload.organizationRole,
      jti: payload.jti,
      sessionId: session.id,
    };
  }

  /**
   * Rotate a refresh token.
   * Detects reuse: if the token has already been rotated, revoke the entire family.
   */
  async rotateRefreshToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenResponse> {
    let payload: JwtPayload;
    try {
      payload = this.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    this.validateClaims(payload);
    if (payload.type !== TokenType.REFRESH) throw new UnauthorizedException('Wrong token type');

    const session = await this.prisma.session.findUnique({ where: { jti: payload.jti } });

    // Reuse detection: session not found means it was already rotated or deleted
    if (!session) {
      // Revoke any live session in this family (defensive — family may still have active rows)
      await this.prisma.session.updateMany({
        where: { tokenFamily: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token reuse detected — all sessions revoked');
    }

    if (session.revokedAt) throw new UnauthorizedException('Session already revoked');

    // Compare supplied token against stored hash
    const hashMatch = await bcryptCompare(refreshToken, session.refreshTokenHash ?? '');
    if (!hashMatch) {
      // Token mismatch — potential theft; revoke entire family
      await this.prisma.session.updateMany({
        where: { tokenFamily: session.tokenFamily, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token invalid — all sessions revoked');
    }

    // Fetch user to embed fresh claims
    const user = await this.prisma.adminUser.findUnique({
      where: { id: payload.adminId },
      include: {
        organizationMembers: {
          where: { isActive: true },
          take: 1,
        },
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Account disabled');

    const member = user.organizationMembers[0];
    const input: CreateSessionInput = {
      adminId: user.id,
      email: user.email,
      platformRole: user.platformRole ?? undefined,
      organizationId: member?.organizationId,
      organizationRole: member?.organizationRole,
    };

    const newJti = randomBytes(16).toString('hex');
    const newAccessToken = this.sign(this.buildAccessPayload(input, newJti));
    const newRefreshToken = this.sign(this.buildRefreshPayload(input, newJti));
    const newRefreshHash = await bcryptHash(newRefreshToken, 10);
    const now = Date.now();

    await this.prisma.$transaction(async (tx) => {
      // Revoke the old session
      await tx.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      // Create the replacement
      await tx.session.create({
        data: {
          adminUserId: user.id,
          jti: newJti,
          tokenFamily: session.tokenFamily, // keep same family for reuse tracking
          refreshTokenHash: newRefreshHash,
          accessExpiresAt: new Date(now + this.config.accessTokenExpiresIn * 1000),
          refreshExpiresAt: new Date(now + this.config.refreshTokenExpiresIn * 1000),
          ipAddress,
          userAgent,
        },
      });
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.config.accessTokenExpiresIn,
      tokenType: 'Bearer',
    };
  }

  /** Revoke one session (logout). */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every active session for a user (password change, account disable). */
  async revokeAllUserSessions(adminId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { adminUserId: adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
