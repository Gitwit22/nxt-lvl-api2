import { ForbiddenException, Logger } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService.listMembers', () => {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const requestingAdmin = {
    id: 'admin-1',
    organizationId: 'org-1',
    email: 'admin@example.com',
    passwordHash: 'hash',
    firstName: 'EA Management',
    lastName: 'Admin',
    jobTitle: 'Program manager',
    role: AdminRole.org_admin,
    isActive: true,
    lastLoginAt: null,
    createdAt,
    updatedAt: createdAt,
  };
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  };
  const request = {
    headers: { 'x-admin-id': requestingAdmin.id },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  function createService() {
    return new OrganizationsService(
      request,
      prisma as unknown as PrismaService,
      {} as NotificationsService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminUser.findUnique.mockResolvedValue(requestingAdmin);
    prisma.organization.findUnique.mockResolvedValue({ principalAdminId: requestingAdmin.id });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps members and identifies principal and pending invitations', async () => {
    prisma.adminUser.findMany.mockResolvedValue([
      { ...requestingAdmin, invitation: null },
      {
        ...requestingAdmin,
        id: 'admin-2',
        email: 'invited@example.com',
        role: AdminRole.reviewer,
        isActive: false,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        invitation: { acceptedAt: null, revokedAt: null },
      },
    ]);

    const members = await createService().listMembers('org-1');

    expect(members).toEqual([
      expect.objectContaining({
        id: requestingAdmin.id,
        invitePending: false,
        isPrincipal: true,
      }),
      expect.objectContaining({
        id: 'admin-2',
        invitePending: true,
        isPrincipal: false,
      }),
    ]);
    expect(members.filter((member) => member.id === requestingAdmin.id)).toHaveLength(1);
  });

  it('reconciles the verified requester when the member query omits them', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    prisma.adminUser.findMany.mockResolvedValue([]);

    const members = await createService().listMembers('org-1');

    expect(members).toEqual([
      expect.objectContaining({
        id: requestingAdmin.id,
        email: requestingAdmin.email,
        invitePending: false,
        isPrincipal: true,
      }),
    ]);
    expect(warn).toHaveBeenCalledWith({
      message: 'Member query omitted authenticated admin.',
      adminId: requestingAdmin.id,
      organizationId: 'org-1',
    });
  });

  it('rejects access to another organization before listing members', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({
      ...requestingAdmin,
      organizationId: 'org-2',
    });

    await expect(createService().listMembers('org-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.adminUser.findMany).not.toHaveBeenCalled();
  });
});