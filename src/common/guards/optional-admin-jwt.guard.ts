import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { PartitionRequest } from '../interfaces/partition-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtGuard } from './admin-jwt.guard';

/** Identity headers that only AdminJwtGuard may set; never trusted from the client. */
export const ADMIN_IDENTITY_HEADERS = ['x-admin-id', 'x-admin-email', 'x-admin-roles', 'x-session-id', 'x-org-id'] as const;

/**
 * Lets anonymous requests through while still identifying signed-in admins.
 * Client-supplied identity headers are stripped first, so downstream code can
 * treat their presence as proof of a verified session.
 */
@Injectable()
export class OptionalAdminJwtGuard implements CanActivate {
  private readonly adminJwtGuard: AdminJwtGuard;

  constructor(prisma: PrismaService) {
    this.adminJwtGuard = new AdminJwtGuard(prisma);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PartitionRequest>();
    for (const header of ADMIN_IDENTITY_HEADERS) {
      delete request.headers[header];
    }

    try {
      await this.adminJwtGuard.canActivate(context);
    } catch {
      for (const header of ADMIN_IDENTITY_HEADERS) {
        delete request.headers[header];
      }
    }
    return true;
  }
}

export function getAdminRoles(request: PartitionRequest): string[] {
  const rolesHeader = request.headers['x-admin-roles'];
  return typeof rolesHeader === 'string' ? rolesHeader.split(',').filter(Boolean) : [];
}
