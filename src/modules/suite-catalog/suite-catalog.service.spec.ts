import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Program, ProgramStatus, ProgramType } from '@prisma/client';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import type { FilesService } from '../files/files.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { SuiteCatalogService, toCatalogRecord } from './suite-catalog.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: 'suite-timeflow',
    organizationId: 'org-nxt',
    name: 'TimeFlow',
    slug: 'timeflow',
    type: ProgramType.suite_app,
    status: ProgramStatus.active,
    settings: { catalog: { status: 'live', externalUrl: 'https://timeflow.nltops.com/', displayOrder: 1 } },
    createdAt: new Date('2026-10-07T00:00:00Z'),
    updatedAt: new Date('2026-10-07T00:00:00Z'),
    ...overrides,
  } as Program;
}

function build(options: { partition?: string; roles?: string; orgId?: string } = {}) {
  const prisma = {
    organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-nxt' }) },
    program: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const files = {
    getStorageKey: jest.fn((...parts: string[]) => ['nxt-lvl-hub', ...parts].join('/')),
    putPublicObject: jest.fn(async ({ objectKey }: { objectKey: string }) => ({
      bucketName: 'api2storage',
      objectKey,
      publicUrl: `https://cdn.example.com/${objectKey}`,
    })),
  };
  const headers: Record<string, string> = {};
  if (options.roles) headers['x-admin-roles'] = options.roles;
  if (options.orgId) headers['x-org-id'] = options.orgId;
  const request = {
    headers,
    partition: { slug: options.partition ?? 'nxt-lvl-suites', organizationSlug: 'nxt-lvl' },
  } as unknown as PartitionRequest;
  const service = new SuiteCatalogService(request, prisma as unknown as PrismaService, files as unknown as FilesService);
  return { service, prisma, files };
}

const platformAdmin = { roles: 'super_admin', orgId: 'org-nxt' };

describe('toCatalogRecord', () => {
  it('fills defaults and exposes the hub ProgramRecord shape', () => {
    const record = toCatalogRecord(program());
    expect(record).toMatchObject({
      id: 'suite-timeflow',
      slug: 'timeflow',
      name: 'TimeFlow',
      status: 'live',
      externalUrl: 'https://timeflow.nltops.com/',
      isPublic: true,
      adminOnly: false,
      displayOrder: 1,
      organizationId: null,
      createdAt: '2026-10-07T00:00:00.000Z',
    });
  });
});

describe('SuiteCatalogService', () => {
  it('refuses to serve the catalog outside the hub partition', async () => {
    const { service } = build({ partition: 'fba-app' });
    await expect(service.list()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides admin-only, private, archived and deleted entries from anonymous visitors', async () => {
    const { service, prisma } = build();
    prisma.program.findMany.mockResolvedValue([
      program(),
      program({ id: 'a', slug: 'a', settings: { catalog: { adminOnly: true } } }),
      program({ id: 'b', slug: 'b', settings: { catalog: { isPublic: false } } }),
      program({ id: 'c', slug: 'c', status: ProgramStatus.archived, settings: { catalog: { status: 'archived' } } }),
      program({ id: 'd', slug: 'd', settings: { catalog: {}, deletedAt: '2026-10-07T00:00:00Z' } }),
    ]);
    const records = await service.list();
    expect(records.map((record) => record.id)).toEqual(['suite-timeflow']);
  });

  it('shows hidden entries (but not deleted ones) to platform admins of the catalog org', async () => {
    const { service, prisma } = build(platformAdmin);
    prisma.program.findMany.mockResolvedValue([
      program(),
      program({ id: 'a', slug: 'a', settings: { catalog: { adminOnly: true } } }),
      program({ id: 'd', slug: 'd', settings: { catalog: {}, deletedAt: '2026-10-07T00:00:00Z' } }),
    ]);
    const records = await service.list();
    expect(records.map((record) => record.id).sort()).toEqual(['a', 'suite-timeflow']);
  });

  it('rejects writes from org_admins and from super_admins of another organization', async () => {
    await expect(build({ roles: 'org_admin', orgId: 'org-nxt' }).service.create({ name: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(build({ roles: 'super_admin', orgId: 'org-other' }).service.create({ name: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates suite_app programs in the catalog org with a derived slug', async () => {
    const { service, prisma } = build(platformAdmin);
    prisma.program.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      program({ ...(data as Partial<Program>), id: 'new' }),
    );
    const record = await service.create({ name: 'Ticket Time', status: 'coming-soon', externalUrl: 'https://tickettime.nltops.com' });
    const data = prisma.program.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizationId: 'org-nxt', slug: 'ticket-time', type: ProgramType.suite_app, status: ProgramStatus.active });
    expect(record.status).toBe('coming-soon');
  });

  it('keeps unrelated settings (e.g. imported launchpad metadata) when updating', async () => {
    const { service, prisma } = build(platformAdmin);
    prisma.program.findFirst.mockResolvedValue(
      program({ settings: { catalog: { status: 'live', notes: 'keep' }, launchpad: { iconLetter: 'T' } } }),
    );
    prisma.program.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => program(data as Partial<Program>));
    await service.update('suite-timeflow', { logoUrl: 'https://cdn.example.com/logo.png' });
    const settings = prisma.program.update.mock.calls[0][0].data.settings;
    expect(settings).toMatchObject({
      launchpad: { iconLetter: 'T' },
      catalog: { status: 'live', notes: 'keep', logoUrl: 'https://cdn.example.com/logo.png' },
    });
  });

  it('soft-deletes instead of removing the row', async () => {
    const { service, prisma } = build(platformAdmin);
    prisma.program.findFirst.mockResolvedValue(program());
    prisma.program.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => program(data as Partial<Program>));
    await service.remove('suite-timeflow');
    const data = prisma.program.update.mock.calls[0][0].data;
    expect(data.status).toBe(ProgramStatus.archived);
    expect(data.settings.deletedAt).toEqual(expect.any(String));
  });

  it('stores validated logos in R2 under the hub namespace', async () => {
    const { service, files } = build(platformAdmin);
    const result = await service.uploadLogo({ buffer: PNG });
    expect(result.logoUrl).toMatch(/^https:\/\/cdn\.example\.com\/nxt-lvl-hub\/logos\/\d+-[0-9a-f-]+\.png$/);
    expect(files.putPublicObject).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'image/png' }));
  });

  it('rejects files whose content is not a supported image', async () => {
    const { service, files } = build(platformAdmin);
    await expect(service.uploadLogo({ buffer: Buffer.from('<svg onload="alert(1)"/>') })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(files.putPublicObject).not.toHaveBeenCalled();
  });
});
