import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/types/jwt';

/**
 * Organization Access Guard
 * 
 * Verifies:
 * 1. User is authenticated (JWT is valid)
 * 2. Organization exists and is active
 * 3. User has active membership in the organization
 * 4. Membership is active
 */
@Injectable()
export class OrganizationAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // JWT payload should be set by JwtAuthGuard
    const user = request.user as JwtPayload & { sessionId?: string };

    if (!user || !user.adminId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Get organization ID from route params
    const organizationId = request.params.organizationId;
    if (!organizationId) {
      throw new NotFoundException('Organization ID not provided');
    }

    // Verify organization exists and is active
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.status !== 'active') {
      throw new ForbiddenException('Organization is not active');
    }

    // Check if user is platform admin (can access any organization)
    if (user.platformRole === 'platform_super_admin') {
      request.organization = organization;
      request.membership = { organizationRole: 'platform_super_admin' };
      return true;
    }

    // For regular users, verify membership
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        adminUserId_organizationId: {
          adminUserId: user.adminId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You do not have access to this organization'
      );
    }

    if (!membership.isActive) {
      throw new ForbiddenException(
        'Your membership in this organization is inactive'
      );
    }

    // Attach organization and membership to request
    request.organization = organization;
    request.membership = membership;

    return true;
  }
}
