import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  JwtPayload,
  TokenResponse,
  TokenType,
  TokenConfig,
  DEFAULT_TOKEN_CONFIG,
} from '../types/jwt';
import { randomBytes } from 'crypto';

/**
 * Enhanced JWT Token Service
 * 
 * Features:
 * - Access token (short-lived: 15-60 minutes)
 * - Refresh token (longer-lived: 7 days)
 * - Session tracking and revocation
 * - Proper JWT validation with all required claims
 * - Token rotation on refresh
 * - Session invalidation on logout/password change
 */
@Injectable()
export class EnhancedJwtTokenService {
  private tokenConfig: TokenConfig;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.tokenConfig = this.loadTokenConfig();
  }

  private loadTokenConfig(): TokenConfig {
    return {
      issuer: this.configService.get('JWT_ISSUER', DEFAULT_TOKEN_CONFIG.issuer),
      audience: this.configService.get('JWT_AUDIENCE', DEFAULT_TOKEN_CONFIG.audience),
      accessTokenExpiresIn: parseInt(
        this.configService.get('JWT_ACCESS_EXPIRES_IN', DEFAULT_TOKEN_CONFIG.accessTokenExpiresIn.toString()),
      ),
      refreshTokenExpiresIn: parseInt(
        this.configService.get('JWT_REFRESH_EXPIRES_IN', DEFAULT_TOKEN_CONFIG.refreshTokenExpiresIn.toString()),
      ),
      algorithm: 'HS256',
    };
  }

  /**
   * Generate a new JWT ID (session identifier)
   */
  private generateJti(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Create an access token
   */
  createAccessToken(payload: Partial<JwtPayload>): string {
    const jti = this.generateJti();
    const now = Math.floor(Date.now() / 1000);

    const tokenPayload: JwtPayload = {
      alg: 'HS256',
      iss: this.tokenConfig.issuer,
      aud: this.tokenConfig.audience,
      sub: payload.adminId!,
      exp: now + this.tokenConfig.accessTokenExpiresIn,
      iat: now,
      jti,
      type: TokenType.ACCESS,
      adminId: payload.adminId!,
      email: payload.email!,
      platformRole: payload.platformRole,
      organizationId: payload.organizationId,
      organizationRole: payload.organizationRole,
    };

    return this.jwtService.sign(tokenPayload);
  }

  /**
   * Create a refresh token
   */
  private createRefreshToken(payload: Partial<JwtPayload>, jti: string): string {
    const now = Math.floor(Date.now() / 1000);

    const tokenPayload: JwtPayload = {
      alg: 'HS256',
      iss: this.tokenConfig.issuer,
      aud: this.tokenConfig.audience,
      sub: payload.adminId!,
      exp: now + this.tokenConfig.refreshTokenExpiresIn,
      iat: now,
      jti, // Same JTI as access token for correlation
      type: TokenType.REFRESH,
      adminId: payload.adminId!,
      email: payload.email!,
    };

    return this.jwtService.sign(tokenPayload);
  }

  /**
   * Issue both access and refresh tokens with session tracking
   */
  async issueTokens(
    payload: Partial<JwtPayload>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ tokens: TokenResponse; sessionId: string }> {
    const jti = this.generateJti();

    // Create tokens
    const accessTokenPayload: JwtPayload = {
      alg: 'HS256',
      iss: this.tokenConfig.issuer,
      aud: this.tokenConfig.audience,
      sub: payload.adminId!,
      exp: Math.floor(Date.now() / 1000) + this.tokenConfig.accessTokenExpiresIn,
      iat: Math.floor(Date.now() / 1000),
      jti,
      type: TokenType.ACCESS,
      adminId: payload.adminId!,
      email: payload.email!,
      platformRole: payload.platformRole,
      organizationId: payload.organizationId,
      organizationRole: payload.organizationRole,
    };

    const accessToken = this.jwtService.sign(accessTokenPayload);
    const refreshToken = this.createRefreshToken(payload, jti);

    // Store session in database
    const session = await this.prisma.session.create({
      data: {
        adminUserId: payload.adminId!,
        jti,
        accessToken,
        accessExpiresAt: new Date(accessTokenPayload.exp * 1000),
        refreshToken,
        refreshExpiresAt: new Date(
          (Math.floor(Date.now() / 1000) + this.tokenConfig.refreshTokenExpiresIn) * 1000,
        ),
        ipAddress,
        userAgent,
      },
    });

    return {
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.tokenConfig.accessTokenExpiresIn,
        tokenType: 'Bearer',
      },
      sessionId: session.id,
    };
  }

  /**
   * Validate and decode an access token with strict claim validation
   */
  validateAccessToken(token: string): JwtPayload {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(token, {
        algorithms: ['HS256'], // Only allow HS256
      });

      // Validate required claims
      this.validateClaims(decoded);

      if (decoded.type !== TokenType.ACCESS) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Refresh an access token using a refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    sessionId: string,
  ): Promise<TokenResponse> {
    try {
      // Verify refresh token signature and claims
      const decoded = this.jwtService.verify<JwtPayload>(refreshToken, {
        algorithms: ['HS256'],
      });

      this.validateClaims(decoded);

      if (decoded.type !== TokenType.REFRESH) {
        throw new Error('Invalid token type');
      }

      // Check session exists and is not revoked
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session || session.revokedAt) {
        throw new Error('Session not found or revoked');
      }

      if (session.refreshToken !== refreshToken) {
        throw new Error('Token mismatch');
      }

      // Generate new access token with same JTI
      const adminUser = await this.prisma.adminUser.findUnique({
        where: { id: decoded.adminId },
      });

      if (!adminUser || !adminUser.isActive) {
        throw new Error('User not found or inactive');
      }

      const newAccessToken = this.createAccessToken({
        adminId: adminUser.id,
        email: adminUser.email,
        platformRole: adminUser.platformRole?.toString(),
      });

      // Update session with new access token
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          accessToken: newAccessToken,
          accessExpiresAt: new Date(
            Math.floor(Date.now() / 1000 + this.tokenConfig.accessTokenExpiresIn) * 1000,
          ),
          updatedAt: new Date(),
        },
      });

      return {
        accessToken: newAccessToken,
        refreshToken,
        expiresIn: this.tokenConfig.accessTokenExpiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Revoke a session (logout)
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all sessions for a user (logout all devices)
   */
  async revokeAllUserSessions(adminId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        adminUserId: adminId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Verify token and check if session is still valid
   */
  async validateSession(token: string): Promise<{ valid: boolean; sessionId?: string }> {
    try {
      const decoded = this.validateAccessToken(token);

      // Check if session is revoked
      const session = await this.prisma.session.findUnique({
        where: { jti: decoded.jti },
      });

      if (!session || session.revokedAt) {
        return { valid: false };
      }

      // Check if token hasn't expired
      if (decoded.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false };
      }

      return { valid: true, sessionId: session.id };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Validate all required JWT claims
   */
  private validateClaims(payload: JwtPayload): void {
    const now = Math.floor(Date.now() / 1000);

    if (!payload.alg || payload.alg !== 'HS256') {
      throw new Error('Invalid algorithm');
    }

    if (!payload.iss || payload.iss !== this.tokenConfig.issuer) {
      throw new Error('Invalid issuer');
    }

    if (!payload.aud || payload.aud !== this.tokenConfig.audience) {
      throw new Error('Invalid audience');
    }

    if (!payload.sub) {
      throw new Error('Missing subject');
    }

    if (!payload.exp || payload.exp < now) {
      throw new Error('Token expired');
    }

    if (!payload.iat || payload.iat > now) {
      throw new Error('Invalid issued time');
    }

    if (!payload.jti) {
      throw new Error('Missing JWT ID');
    }

    if (!payload.type || ![TokenType.ACCESS, TokenType.REFRESH].includes(payload.type)) {
      throw new Error('Invalid token type');
    }
  }
}
