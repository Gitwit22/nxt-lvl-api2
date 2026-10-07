import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProgramStatus, ProgramType } from '@prisma/client';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import { ProgramsService } from './programs.service';

function build(headers: Record<string, string> = {}) {
  const prisma = {
    program: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    organization: { findFirst: jest.fn() },
  };
  const request = {
    headers,
    partition: { slug: 'fba-app', organizationSlug: 'nxt-lvl', primaryProgramSlug: 'fba-app' },
  } as unknown as PartitionRequest;
  return { service: new ProgramsService(request, prisma as unknown as PrismaService), prisma };
}

describe('ProgramsService authorization', () => {
  it('gives anonymous callers a minimal listing scoped to the partition organization', async () => {
    const { service, prisma } = build();
    await service.listPrograms();
    const query = prisma.program.findMany.mock.calls[0][0];
    expect(query.where).toMatchObject({ organization: { slug: 'nxt-lvl' }, status: { not: ProgramStatus.archived } });
    expect(query.select).toEqual({ id: true, name: true, slug: true, type: true, status: true });
  });

  it('scopes signed-in org admins to their own organization', async () => {
    const { service, prisma } = build({ 'x-org-id': 'org-1', 'x-admin-roles': 'org_admin' });
    await service.listPrograms();
    expect(prisma.program.findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org-1' });
  });

  it('blocks org admins from creating programs in another organization', () => {
    const { service, prisma } = build({ 'x-org-id': 'org-1', 'x-admin-roles': 'org_admin' });
    expect(() =>
      service.createProgram({ organizationId: 'org-2', name: 'X', slug: 'x', type: ProgramType.business_directory }),
    ).toThrow(ForbiddenException);
    expect(prisma.program.create).not.toHaveBeenCalled();
  });

  it('blocks org admins from updating another organization’s program', async () => {
    const { service, prisma } = build({ 'x-org-id': 'org-1', 'x-admin-roles': 'org_admin' });
    prisma.program.findUnique.mockResolvedValue({ id: 'p', organizationId: 'org-2', type: ProgramType.business_directory });
    await expect(service.updateProgram('p', { name: 'Renamed' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.program.update).not.toHaveBeenCalled();
  });

  it('keeps suite catalog programs out of the generic endpoints', async () => {
    const { service, prisma } = build({ 'x-org-id': 'org-1', 'x-admin-roles': 'super_admin' });
    expect(() =>
      service.createProgram({ organizationId: 'org-1', name: 'X', slug: 'x', type: ProgramType.suite_app }),
    ).toThrow(BadRequestException);
    prisma.program.findUnique.mockResolvedValue({ id: 'p', organizationId: 'org-1', type: ProgramType.suite_app });
    await expect(service.updateProgram('p', { name: 'Renamed' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
