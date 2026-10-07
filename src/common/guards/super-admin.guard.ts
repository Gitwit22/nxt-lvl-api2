import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { PartitionRequest } from '../interfaces/partition-request.interface';
import { getAdminRoles } from './optional-admin-jwt.guard';

/** Requires a super_admin. Must be applied after AdminJwtGuard, which sets x-admin-roles. */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PartitionRequest>();
    if (!getAdminRoles(request).includes('super_admin')) {
      throw new ForbiddenException('Only platform admins can perform this action.');
    }
    return true;
  }
}
