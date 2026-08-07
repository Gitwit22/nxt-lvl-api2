import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { EnhancedJwtTokenService } from '../../modules/auth/services/enhanced-jwt-token.service';

/**
 * AdminJwtGuard
 *
 * Reads the access token from the __Host-clientflow_access HttpOnly cookie.
 * Falls back to the Authorization Bearer header for tooling / server-to-server calls.
 * Validates the token signature, all standard claims, and checks the DB session is
 * active (not revoked). Attaches `req.adminUser` with decoded claims.
 */
@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly tokenService: EnhancedJwtTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { adminUser?: unknown; sessionId?: string }>();

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('No authentication token provided.');

    const claims = await this.tokenService.verifyAccessToken(token);

    req.adminUser = claims;
    req.sessionId = claims.sessionId;
    return true;
  }

  private extractToken(req: Request): string | null {
    // Prefer HttpOnly cookie
    const fromCookie = (req.cookies as Record<string, string | undefined>)?.['__Host-clientflow_access'];
    if (fromCookie) return fromCookie;

    // Fall back to Authorization header (for API tooling)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);

    return null;
  }
}

