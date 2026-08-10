import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { PartitionRequest } from '../interfaces/partition-request.interface';
import { JwtTokenService } from '../../modules/auth/infrastructure/jwt-token-service';

@Injectable()
export class AdminJwtGuard implements CanActivate {
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
      request.headers['x-admin-id'] = payload.sub;
      request.headers['x-admin-email'] = payload.email;
      request.headers['x-admin-roles'] = (payload.roles ?? []).join(',');
      const orgId = (payload as unknown as Record<string, unknown>)['organizationId'];
      if (orgId) request.headers['x-org-id'] = String(orgId);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}


