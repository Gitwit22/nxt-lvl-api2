import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AdminRole, Prisma } from '@prisma/client';
import { hash } from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';

@Injectable({ scope: Scope.REQUEST })
export class OrganizationsService {
  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getAdminId(): string {
    const id = this.request.headers['x-admin-id'] as string | undefined;
    if (!id) throw new ForbiddenException('Not authenticated.');
    return id;
  }

  private async verifyOrgAccess(orgId: string) {
    const adminId = this.getAdminId();
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin || admin.organizationId !== orgId) {
      throw new ForbiddenException('Access denied to this organization.');
    }
    return admin;
  }

  async getSettings(orgId: string) {
    await this.verifyOrgAccess(orgId);
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        principalAdmin: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found.');
    const settings = (org.settings as Record<string, unknown>) ?? {};
    return {
      id: org.id,
      name: org.name,
      settings,
      liveMode: org.liveMode,
      demoRemovedAt: org.demoRemovedAt,
      principal: org.principalAdmin,
    };
  }

  async updateSettings(orgId: string, dto: UpdateOrgSettingsDto) {
    await this.verifyOrgAccess(orgId);
    const existing = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!existing) throw new NotFoundException('Organization not found.');

    const existingSettings = (existing.settings as Record<string, unknown>) ?? {};
    const newSettings: Record<string, unknown> = { ...existingSettings };
    if (dto.replyToEmail !== undefined) newSettings['replyToEmail'] = dto.replyToEmail;
    if (dto.defaultMonitoringFrequency !== undefined) {
      newSettings['defaultMonitoringFrequency'] = dto.defaultMonitoringFrequency;
    }

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        settings: newSettings as Prisma.InputJsonValue,
      },
      include: {
        principalAdmin: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    return {
      id: updated.id,
      name: updated.name,
      settings: (updated.settings as Record<string, unknown>) ?? {},
      liveMode: updated.liveMode,
      demoRemovedAt: updated.demoRemovedAt,
      principal: updated.principalAdmin,
    };
  }

  async listMembers(orgId: string) {
    await this.verifyOrgAccess(orgId);
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { principalAdminId: true },
    });
    const members = await this.prisma.adminUser.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        invitation: { select: { acceptedAt: true, revokedAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.id,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      role: m.role,
      isActive: m.isActive,
      createdAt: m.createdAt,
      invitePending: m.invitation
        ? m.invitation.acceptedAt === null && m.invitation.revokedAt === null
        : false,
      isPrincipal: m.id === organization?.principalAdminId,
    }));
  }

  async inviteMember(orgId: string, dto: InviteMemberDto) {
    await this.verifyOrgAccess(orgId);

    const existing = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('A user with this email already exists.');

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found.');

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Random password hash — user cannot log in until they accept the invite
    const randomPasswordHash = await hash(randomBytes(32).toString('hex'), 12);

    await this.prisma.adminUser.create({
      data: {
        organizationId: orgId,
        email: dto.email,
        passwordHash: randomPasswordHash,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        role: dto.role ?? AdminRole.reviewer,
        isActive: false,
        invitation: {
          create: { tokenHash, expiresAt },
        },
      },
    });

    const appUrl = process.env['APP_URL'] ?? this.request.partition.appUrl;
    const inviteUrl = `${appUrl}/accept-invite?token=${plainToken}`;
    const roleLabel = (dto.role ?? AdminRole.reviewer) === AdminRole.org_admin ? 'Admin' : 'Staff';

    await this.notificationsService.sendInviteEmail({
      to: dto.email,
      firstName: dto.firstName,
      orgName: org.name,
      role: roleLabel,
      inviteUrl,
    });

    return { message: `Invitation sent to ${dto.email}.` };
  }

  async updateMemberRole(orgId: string, memberId: string, dto: UpdateMemberRoleDto) {
    await this.verifyOrgAccess(orgId);
    const member = await this.prisma.adminUser.findFirst({
      where: { id: memberId, organizationId: orgId },
    });
    if (!member) throw new NotFoundException('Member not found.');
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { principalAdminId: true },
    });
    if (organization?.principalAdminId === memberId) {
      throw new BadRequestException('The organization principal cannot be demoted.');
    }
    if (memberId === this.getAdminId()) {
      throw new BadRequestException('You cannot change your own role.');
    }
    return this.prisma.adminUser.update({
      where: { id: memberId },
      data: { role: dto.role },
      select: { id: true, email: true, role: true },
    });
  }

  async disableMember(orgId: string, memberId: string) {
    await this.verifyOrgAccess(orgId);
    const member = await this.prisma.adminUser.findFirst({
      where: { id: memberId, organizationId: orgId },
    });
    if (!member) throw new NotFoundException('Member not found.');
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { principalAdminId: true },
    });
    if (organization?.principalAdminId === memberId) {
      throw new BadRequestException('The organization principal cannot be disabled.');
    }
    if (memberId === this.getAdminId()) {
      throw new BadRequestException('You cannot disable your own account.');
    }
    await this.prisma.adminUser.update({ where: { id: memberId }, data: { isActive: false } });
    return { message: 'Member disabled.' };
  }

  async enableMember(orgId: string, memberId: string) {
    await this.verifyOrgAccess(orgId);
    const member = await this.prisma.adminUser.findFirst({
      where: { id: memberId, organizationId: orgId },
    });
    if (!member) throw new NotFoundException('Member not found.');
    await this.prisma.adminUser.update({ where: { id: memberId }, data: { isActive: true } });
    return { message: 'Member enabled.' };
  }
}
