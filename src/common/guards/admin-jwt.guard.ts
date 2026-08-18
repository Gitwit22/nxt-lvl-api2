import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { PartitionRequest } from '../interfaces/partition-request.interface';
import { JwtTokenService } from '../../modules/auth/infrastructure/jwt-token-service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PartitionRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authHeader.substring(7);

    try {
      const tokenService = new JwtTokenService(request.partition.authIssuer);
      const payload = await tokenService.verify(token);
      const tokenData = payload as unknown as Record<string, unknown>;
      const sessionId = String(tokenData['sessionId'] ?? '');
      const jti = String(tokenData['jti'] ?? '');
      if (!sessionId || !jti) throw new UnauthorizedException('Authenticated session is missing.');
      const session = await this.prisma.authSession.findFirst({
        where: {
          id: sessionId,
          jti,
          adminUserId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          adminUser: { isActive: true },
        },
        include: { adminUser: { select: { organizationId: true } } },
      });
      if (!session) throw new UnauthorizedException('Authenticated session is no longer active.');
      request.headers['x-admin-id'] = payload.sub;
      request.headers['x-admin-email'] = payload.email;
      request.headers['x-admin-roles'] = (payload.roles ?? []).join(',');
      request.headers['x-session-id'] = sessionId;
      const orgId = tokenData['organizationId'];
      if (orgId && String(orgId) !== session.adminUser.organizationId) {
        throw new UnauthorizedException('Authenticated organization is invalid.');
      }
      request.headers['x-org-id'] = session.adminUser.organizationId;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}


