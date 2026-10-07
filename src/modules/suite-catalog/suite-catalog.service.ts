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
import { Prisma, Program, ProgramStatus, ProgramType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { SUITES_PARTITION_SLUG } from '../../common/services/partition.service';
import { getAdminRoles } from '../../common/guards/optional-admin-jwt.guard';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogStatus, CreateCatalogProgramDto, UpdateCatalogProgramDto } from './dto/catalog-program.dto';
import { detectLogoImage } from './logo-image';

type CatalogFields = Omit<CreateCatalogProgramDto, 'name' | 'slug' | 'organizationId' | 'id'>;

/** Shape returned to the hub; mirrors the hub's ProgramRecord contract. */
export interface CatalogProgramRecord extends Required<Omit<CatalogFields, 'secondaryCategory' | 'internalRoute'>> {
  id: string;
  slug: string;
  name: string;
  organizationId: null;
  secondaryCategory?: string;
  internalRoute?: string;
  createdAt: string;
  updatedAt: string;
}

const CATALOG_DEFAULTS: Required<CatalogFields> = {
  shortDescription: '',
  longDescription: '',
  category: 'Operations',
  secondaryCategory: '',
  tags: [],
  status: 'live',
  type: 'external',
  origin: 'suite-native',
  internalRoute: '',
  externalUrl: '',
  logoUrl: '',
  screenshotUrl: '',
  openInNewTab: true,
  accentColor: '',
  cardBackgroundColor: '',
  cardBackgroundOpacity: 0,
  cardGlowColor: '',
  cardGlowOpacity: 0,
  cardHoverTintOpacity: 0,
  adminOnly: false,
  isFeatured: false,
  isPublic: true,
  requiresLogin: false,
  requiresApproval: false,
  launchLabel: 'Launch Program',
  displayOrder: 100,
  notes: '',
};

const CATALOG_FIELD_KEYS = Object.keys(CATALOG_DEFAULTS) as (keyof CatalogFields)[];

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function toCatalogRecord(program: Program): CatalogProgramRecord {
  const stored = asObject(asObject(program.settings)['catalog']);
  const catalog = { ...CATALOG_DEFAULTS } as Record<string, unknown>;
  for (const key of CATALOG_FIELD_KEYS) {
    if (stored[key] !== undefined && stored[key] !== null) catalog[key] = stored[key];
  }
  const fields = catalog as Required<CatalogFields>;
  return {
    ...fields,
    secondaryCategory: fields.secondaryCategory || undefined,
    internalRoute: fields.internalRoute || undefined,
    id: program.id,
    slug: program.slug,
    name: program.name,
    organizationId: null,
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}

/** Whether an anonymous visitor may see this entry. */
export function isPubliclyVisible(record: CatalogProgramRecord, program: Program): boolean {
  return (
    program.status !== ProgramStatus.archived &&
    record.status !== 'archived' &&
    record.isPublic &&
    !record.adminOnly
  );
}

function apiStatusFor(status: CatalogStatus): ProgramStatus {
  return status === 'archived' ? ProgramStatus.archived : ProgramStatus.active;
}

const LOGO_CACHE_CONTROL = 'public, max-age=31536000, immutable';

@Injectable({ scope: Scope.REQUEST })
export class SuiteCatalogService {
  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  /** The catalog only exists in the hub partition. */
  private assertSuitesPartition(): void {
    if (this.request.partition.slug !== SUITES_PARTITION_SLUG) {
      throw new NotFoundException('Suite catalog is not available for this app partition.');
    }
  }

  private async getCatalogOrganizationId(): Promise<string> {
    const organization = await this.prisma.organization.findUnique({
      where: { slug: this.request.partition.organizationSlug },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Catalog organization is not configured.');
    return organization.id;
  }

  private isPlatformAdmin(): boolean {
    return getAdminRoles(this.request).includes('super_admin');
  }

  /** Mutations: a super_admin who belongs to the catalog's organization (tenant boundary). */
  private async assertCanManage(): Promise<string> {
    this.assertSuitesPartition();
    const organizationId = await this.getCatalogOrganizationId();
    if (!this.isPlatformAdmin() || this.request.headers['x-org-id'] !== organizationId) {
      throw new ForbiddenException('Only platform admins can manage the suite catalog.');
    }
    return organizationId;
  }

  private async findCatalogProgram(organizationId: string, id: string): Promise<Program> {
    const program = await this.prisma.program.findFirst({
      where: { id, organizationId, type: ProgramType.suite_app },
    });
    if (!program || asObject(program.settings)['deletedAt']) throw new NotFoundException('Program not found.');
    return program;
  }

  async list(): Promise<CatalogProgramRecord[]> {
    this.assertSuitesPartition();
    const organizationId = await this.getCatalogOrganizationId();
    const programs = await this.prisma.program.findMany({
      where: { organizationId, type: ProgramType.suite_app },
      orderBy: { createdAt: 'asc' },
    });
    const includeHidden = this.isPlatformAdmin() && this.request.headers['x-org-id'] === organizationId;
    return programs
      .filter((program) => !asObject(program.settings)['deletedAt'])
      .map((program) => ({ program, record: toCatalogRecord(program) }))
      .filter(({ program, record }) => includeHidden || isPubliclyVisible(record, program))
      .map(({ record }) => record)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  }

  async get(id: string): Promise<CatalogProgramRecord> {
    this.assertSuitesPartition();
    const organizationId = await this.getCatalogOrganizationId();
    const program = await this.findCatalogProgram(organizationId, id);
    const record = toCatalogRecord(program);
    const canSeeHidden = this.isPlatformAdmin() && this.request.headers['x-org-id'] === organizationId;
    if (!canSeeHidden && !isPubliclyVisible(record, program)) throw new NotFoundException('Program not found.');
    return record;
  }

  async create(dto: CreateCatalogProgramDto): Promise<CatalogProgramRecord> {
    const organizationId = await this.assertCanManage();
    const slug = dto.slug || slugify(dto.name);
    if (!slug) throw new BadRequestException('A slug could not be derived from the name.');

    const catalog = this.mergeCatalogFields({}, dto);
    try {
      const program = await this.prisma.program.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          slug,
          type: ProgramType.suite_app,
          status: apiStatusFor(catalog.status),
          settings: { catalog } as unknown as Prisma.InputJsonValue,
        },
      });
      return toCatalogRecord(program);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`A program with slug "${slug}" already exists.`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCatalogProgramDto): Promise<CatalogProgramRecord> {
    const organizationId = await this.assertCanManage();
    const program = await this.findCatalogProgram(organizationId, id);
    const settings = asObject(program.settings);
    const catalog = this.mergeCatalogFields(asObject(settings['catalog']), dto);

    try {
      const updated = await this.prisma.program.update({
        where: { id: program.id },
        data: {
          ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
          ...(dto.slug ? { slug: dto.slug } : {}),
          status: apiStatusFor(catalog.status),
          // Preserve other settings keys (e.g. imported launchpad metadata).
          settings: { ...settings, catalog } as unknown as Prisma.InputJsonValue,
        },
      });
      return toCatalogRecord(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`A program with slug "${dto.slug}" already exists.`);
      }
      throw error;
    }
  }

  /** Soft delete: the row and its settings stay recoverable in the database. */
  async remove(id: string): Promise<CatalogProgramRecord> {
    const organizationId = await this.assertCanManage();
    const program = await this.findCatalogProgram(organizationId, id);
    const settings = asObject(program.settings);
    const updated = await this.prisma.program.update({
      where: { id: program.id },
      data: {
        status: ProgramStatus.archived,
        settings: { ...settings, deletedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue,
      },
    });
    return toCatalogRecord(updated);
  }

  async uploadLogo(file: { buffer: Buffer } | undefined): Promise<{ fileName: string; logoUrl: string }> {
    await this.assertCanManage();
    if (!file?.buffer?.length) throw new BadRequestException('Logo file is required.');

    const image = detectLogoImage(file.buffer);
    if (!image) throw new BadRequestException('File content is not a valid PNG, JPG, GIF, or WEBP image.');

    const fileName = `${Date.now()}-${randomUUID()}.${image.extension}`;
    const stored = await this.files.putPublicObject({
      objectKey: this.files.getStorageKey('logos', fileName),
      body: file.buffer,
      contentType: image.mimeType,
      cacheControl: LOGO_CACHE_CONTROL,
    });
    return { fileName, logoUrl: stored.publicUrl };
  }

  private mergeCatalogFields(
    current: Record<string, unknown>,
    dto: Partial<CreateCatalogProgramDto>,
  ): Required<CatalogFields> {
    const merged = { ...CATALOG_DEFAULTS } as Record<string, unknown>;
    for (const key of CATALOG_FIELD_KEYS) {
      const incoming = dto[key];
      if (incoming !== undefined && incoming !== null) merged[key] = incoming;
      else if (current[key] !== undefined && current[key] !== null) merged[key] = current[key];
    }
    return merged as Required<CatalogFields>;
  }
}
