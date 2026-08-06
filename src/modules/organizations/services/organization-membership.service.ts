import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationRole } from '../../common/types/roles';
import { InviteMemberDto, UpdateMemberRoleDto } from '../dto/membership.dto';

@Injectable()
export class OrganizationMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get a member by ID for the organization
   * Verifies the member belongs to the organization
   */
  async getMember(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            platformRole: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.organizationId !== organizationId) {
      throw new ForbiddenException('Member does not belong to this organization');
    }

    return member;
  }

  /**
   * Get all members of an organization
   */
  async listMembers(organizationId: string, isActive?: boolean) {
    const where: any = { organizationId };
    
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return await this.prisma.organizationMember.findMany({
      where,
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            platformRole: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Invite a new member to the organization
   */
  async inviteMember(
    organizationId: string,
    invitedByMemberId: string,
    dto: InviteMemberDto,
  ) {
    // Verify inviter is org_admin or org_owner
    const inviter = await this.getMember(organizationId, invitedByMemberId);
    
    if (!['org_admin', 'org_owner'].includes(inviter.organizationRole)) {
      throw new ForbiddenException(
        'Only organization admins and owners can invite members'
      );
    }

    // Check if user already exists
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      // Check if already a member of this org
      const existingMember = await this.prisma.organizationMember.findUnique({
        where: {
          adminUserId_organizationId: {
            adminUserId: existingUser.id,
            organizationId,
          },
        },
      });

      if (existingMember) {
        throw new BadRequestException(
          'User is already a member of this organization'
        );
      }

      // Add existing user to organization
      return await this.prisma.organizationMember.create({
        data: {
          adminUserId: existingUser.id,
          organizationId,
          organizationRole: dto.role || OrganizationRole.REVIEWER,
          joinedAt: new Date(),
          invitedByMemberId,
        },
        include: {
          adminUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      });
    }

    // Create new user and add to organization
    const adminUser = await this.prisma.adminUser.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: '', // Will be set when user accepts invitation
        isActive: false, // Inactive until user accepts
      },
    });

    return await this.prisma.organizationMember.create({
      data: {
        adminUserId: adminUser.id,
        organizationId,
        organizationRole: dto.role || OrganizationRole.REVIEWER,
        invitedByMemberId,
      },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    organizationId: string,
    updatingMemberId: string,
    targetMemberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    // Verify updater is org_admin or org_owner
    const updater = await this.getMember(organizationId, updatingMemberId);
    
    if (!['org_admin', 'org_owner'].includes(updater.organizationRole)) {
      throw new ForbiddenException(
        'Only organization admins and owners can update member roles'
      );
    }

    // Verify target member exists
    const targetMember = await this.getMember(organizationId, targetMemberId);

    // org_owner can only be changed by the owner themselves
    if (targetMember.organizationRole === OrganizationRole.ORG_OWNER &&
        updater.id !== targetMemberId) {
      throw new ForbiddenException('Cannot change organization owner role');
    }

    return await this.prisma.organizationMember.update({
      where: { id: targetMemberId },
      data: {
        organizationRole: dto.role,
        updatedAt: new Date(),
      },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Disable a member (prevents login to organization)
   */
  async disableMember(
    organizationId: string,
    updatingMemberId: string,
    targetMemberId: string,
  ) {
    // Verify updater has permission
    const updater = await this.getMember(organizationId, updatingMemberId);
    
    if (!['org_admin', 'org_owner'].includes(updater.organizationRole)) {
      throw new ForbiddenException(
        'Only organization admins and owners can disable members'
      );
    }

    // Verify target member exists
    const targetMember = await this.getMember(organizationId, targetMemberId);

    // Cannot disable owner
    if (targetMember.organizationRole === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException('Cannot disable organization owner');
    }

    // Disable the membership
    const updated = await this.prisma.organizationMember.update({
      where: { id: targetMemberId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });

    // Revoke all sessions for this user on this organization
    // (implementation depends on session tracking)

    return updated;
  }

  /**
   * Re-enable a member
   */
  async enableMember(
    organizationId: string,
    updatingMemberId: string,
    targetMemberId: string,
  ) {
    // Verify updater has permission
    const updater = await this.getMember(organizationId, updatingMemberId);
    
    if (!['org_admin', 'org_owner'].includes(updater.organizationRole)) {
      throw new ForbiddenException(
        'Only organization admins and owners can enable members'
      );
    }

    // Verify target member exists
    await this.getMember(organizationId, targetMemberId);

    return await this.prisma.organizationMember.update({
      where: { id: targetMemberId },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Remove a member from the organization
   */
  async removeMember(
    organizationId: string,
    updatingMemberId: string,
    targetMemberId: string,
  ) {
    // Verify updater has permission
    const updater = await this.getMember(organizationId, updatingMemberId);
    
    if (!['org_admin', 'org_owner'].includes(updater.organizationRole)) {
      throw new ForbiddenException(
        'Only organization admins and owners can remove members'
      );
    }

    // Verify target member exists
    const targetMember = await this.getMember(organizationId, targetMemberId);

    // Cannot remove owner
    if (targetMember.organizationRole === OrganizationRole.ORG_OWNER) {
      throw new ForbiddenException('Cannot remove organization owner');
    }

    return await this.prisma.organizationMember.delete({
      where: { id: targetMemberId },
    });
  }

  /**
   * Get user's organization membership
   * Used by auth service to verify access
   */
  async getUserOrganizationMembership(
    adminId: string,
    organizationId: string,
  ) {
    return await this.prisma.organizationMember.findUnique({
      where: {
        adminUserId_organizationId: {
          adminUserId: adminId,
          organizationId,
        },
      },
    });
  }

  /**
   * Get all organizations a user belongs to
   */
  async getUserOrganizations(adminId: string) {
    return await this.prisma.organizationMember.findMany({
      where: {
        adminUserId: adminId,
        isActive: true,
      },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
