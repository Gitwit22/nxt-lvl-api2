import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessClaims } from '../../modules/auth/services/enhanced-jwt-token.service';

/**
 * OrganizationAccessGuard
 *
 * Must be applied AFTER AdminJwtGuard, which attaches req.adminUser.
 * Verifies:
 *  1. org exists and status === 'active'
 *  2. user is platform_super_admin  OR  has an active membership in that org
 *
 * Attaches `req.organization` and `req.membership` for downstream use.
 * Does NOT validate the JWT itself — AdminJwtGuard owns that responsibility.
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { adminUser?: AccessClaims; organization?: unknown; membership?: unknown }>();

    const claims = (req as unknown as Record<string, unknown>)['adminUser'] as AccessClaims | undefined;
    if (!claims?.adminId) throw new UnauthorizedException('Not authenticated.');

    const params = (req as unknown as Record<string, unknown>)['params'] as Record<string, string> | undefined;
    const organizationId = params?.['organizationId'];
    if (!organizationId) throw new NotFoundException('organizationId route param missing.');

    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new NotFoundException('Organization not found.');
    if (organization.status !== 'active') throw new ForbiddenException('Organization is not active.');

    // Platform super-admins bypass membership check
    if (claims.platformRole === 'platform_super_admin') {
      (req as unknown as Record<string, unknown>)['organization'] = organization;
      (req as unknown as Record<string, unknown>)['membership'] = null;
      return true;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { adminUserId_organizationId: { adminUserId: claims.adminId, organizationId } },
    });

    if (!membership) throw new ForbiddenException('No access to this organization.');
    if (!membership.isActive) throw new ForbiddenException('Membership is inactive.');

    (req as unknown as Record<string, unknown>)['organization'] = organization;
    (req as unknown as Record<string, unknown>)['membership'] = membership;
    return true;
  }
}
