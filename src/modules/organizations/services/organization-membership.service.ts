import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrganizationRole } from '../../../common/types/roles';
import { InviteMemberDto, UpdateMemberRoleDto } from '../dto/membership.dto';
import type { AccessClaims } from '../../auth/services/enhanced-jwt-token.service';

const ADMIN_MEMBER_ROLES: OrganizationRole[] = [OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN];

@Injectable()
export class OrganizationMembershipService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Private helpers ────────────────────────────────────────────────────────

  private memberSelect = {
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
  };

  private async requireAdminMember(organizationId: string, memberId: string | null) {
    if (!memberId) return null; // platform super admin — skip check
    const member = await this.getMember(organizationId, memberId);
    if (!ADMIN_MEMBER_ROLES.includes(member.organizationRole as OrganizationRole)) {
      throw new ForbiddenException('Insufficient organization role.');
    }
    return member;
  }

  private async countActiveOwners(organizationId: string) {
    return this.prisma.organizationMember.count({
      where: { organizationId, organizationRole: OrganizationRole.ORG_OWNER, isActive: true },
    });
  }

  private async auditMembership(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    organizationId: string,
    actorAdminId: string | null,
    action: 'created' | 'updated' | 'deleted',
    targetId: string,
    before?: unknown,
    after?: unknown,
  ) {
    await tx.auditLog.create({
      data: {
        organizationId,
        actorAdminId,
        action,
        targetType: 'OrganizationMember',
        targetId,
        beforeData: before as never,
        afterData: after as never,
      },
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async getMember(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      ...this.memberSelect,
    });

    if (!member) throw new NotFoundException('Member not found.');
    if (member.organizationId !== organizationId) throw new ForbiddenException('Member does not belong to this organization.');

    return member;
  }

  async listMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      ...this.memberSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async inviteMember(organizationId: string, invitedByMemberId: string | null, dto: InviteMemberDto) {
    await this.requireAdminMember(organizationId, invitedByMemberId);

    // Prevent creating a second org_owner
    if (dto.role === OrganizationRole.ORG_OWNER) {
      throw new BadRequestException('Cannot assign org_owner via invitation. Transfer ownership explicitly.');
    }

    return this.prisma.$transaction(async (tx) => {
      let adminUser = await tx.adminUser.findUnique({ where: { email: dto.email.toLowerCase().trim() } });

      if (adminUser) {
        const existing = await tx.organizationMember.findUnique({
          where: { adminUserId_organizationId: { adminUserId: adminUser.id, organizationId } },
        });
        if (existing) throw new BadRequestException('User is already a member of this organization.');
      } else {
        adminUser = await tx.adminUser.create({
          data: {
            email: dto.email.toLowerCase().trim(),
            firstName: dto.firstName,
            lastName: dto.lastName ?? null,
            passwordHash: '', // Set when the user accepts the invitation
            isActive: false,
          },
        });
      }

      const member = await tx.organizationMember.create({
        data: {
          adminUserId: adminUser.id,
          organizationId,
          organizationRole: dto.role ?? OrganizationRole.REVIEWER,
          invitedByMemberId,
        },
        ...this.memberSelect,
      });

      await this.auditMembership(tx, organizationId, adminUser.id, 'created', member.id, null, member);
      return member;
    });
  }

  async updateMemberRole(
    organizationId: string,
    updatingMemberId: string | null,
    targetMemberId: string,
    dto: UpdateMemberRoleDto,
    actor: AccessClaims,
  ) {
    await this.requireAdminMember(organizationId, updatingMemberId);

    const target = await this.getMember(organizationId, targetMemberId);

    // Only the owner themselves can demote from org_owner
    if (target.organizationRole === OrganizationRole.ORG_OWNER) {
      const isOwnerActingOnSelf = target.adminUser.id === actor.adminId;
      if (!isOwnerActingOnSelf && actor.platformRole !== 'platform_super_admin') {
        throw new ForbiddenException('Cannot change the role of an organization owner.');
      }
    }

    // Cannot promote someone to owner here (ownership transfer is explicit)
    if (dto.role === OrganizationRole.ORG_OWNER) {
      throw new BadRequestException('Cannot promote to org_owner via this endpoint.');
    }

    // Prevent last-owner demotion
    if (target.organizationRole === OrganizationRole.ORG_OWNER) {
      const ownerCount = await this.countActiveOwners(organizationId);
      if (ownerCount <= 1) throw new BadRequestException('Cannot demote the last active owner.');
    }

    // Users cannot promote themselves
    if (target.adminUser.id === actor.adminId) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    return this.prisma.$transaction(async (tx) => {
      const before = { organizationRole: target.organizationRole };
      const updated = await tx.organizationMember.update({
        where: { id: targetMemberId },
        data: { organizationRole: dto.role },
        ...this.memberSelect,
      });
      await this.auditMembership(tx, organizationId, actor.adminId, 'updated', targetMemberId, before, { organizationRole: dto.role });
      return updated;
    });
  }

  async disableMember(organizationId: string, updatingMemberId: string | null, targetMemberId: string) {
    await this.requireAdminMember(organizationId, updatingMemberId);

    const target = await this.getMember(organizationId, targetMemberId);

    if (target.organizationRole === OrganizationRole.ORG_OWNER) {
      const ownerCount = await this.countActiveOwners(organizationId);
      if (ownerCount <= 1) throw new BadRequestException('Cannot disable the last active owner.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationMember.update({
        where: { id: targetMemberId },
        data: { isActive: false },
        ...this.memberSelect,
      });

      // Revoke all sessions for this user so they are locked out immediately
      await tx.session.updateMany({
        where: { adminUserId: target.adminUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.auditMembership(tx, organizationId, updatingMemberId, 'updated', targetMemberId,
        { isActive: true }, { isActive: false });

      return updated;
    });
  }

  async enableMember(organizationId: string, updatingMemberId: string | null, targetMemberId: string) {
    await this.requireAdminMember(organizationId, updatingMemberId);
    await this.getMember(organizationId, targetMemberId); // existence check

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organizationMember.update({
        where: { id: targetMemberId },
        data: { isActive: true },
        ...this.memberSelect,
      });
      await this.auditMembership(tx, organizationId, updatingMemberId, 'updated', targetMemberId,
        { isActive: false }, { isActive: true });
      return updated;
    });
  }
}
