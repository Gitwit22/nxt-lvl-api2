import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { PartitionRequest } from '../interfaces/partition-request.interface';

/**
 * Verifies the JWT-authenticated user has an org_admin or super_admin role.
 * Must be applied after AdminJwtGuard, which sets x-admin-roles on the request.
 */
@Injectable()
export class OrgAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PartitionRequest>();
    const rolesHeader = request.headers['x-admin-roles'] as string | undefined;
    const roles = rolesHeader ? rolesHeader.split(',').filter(Boolean) : [];

    if (!roles.includes('org_admin') && !roles.includes('super_admin')) {
      throw new ForbiddenException('Only organization admins can perform this action.');
    }

    return true;
  }
}
