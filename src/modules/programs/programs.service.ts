import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma, Program, ProgramStatus, ProgramType } from '@prisma/client';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { getAdminRoles } from '../../common/guards/optional-admin-jwt.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { UpsertLaunchpadStateDto } from './dto/upsert-launchpad-state.dto';

type LaunchpadState = {
  custom: unknown[];
  hiddenIds: string[];
};

const EMPTY_LAUNCHPAD_STATE: LaunchpadState = {
  custom: [],
  hiddenIds: [],
};

@Injectable({ scope: Scope.REQUEST })
export class ProgramsService {
  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: PrismaService,
  ) {}

  private normalizeLaunchpadState(value: unknown): LaunchpadState {
    if (!value || typeof value !== 'object') {
      return EMPTY_LAUNCHPAD_STATE;
    }

    const raw = value as { custom?: unknown; hiddenIds?: unknown };
    return {
      custom: Array.isArray(raw.custom) ? raw.custom : [],
      hiddenIds: Array.isArray(raw.hiddenIds)
        ? raw.hiddenIds.filter((x): x is string => typeof x === 'string')
        : [],
    };
  }

  private extractLaunchpadState(settings: Prisma.JsonValue | null): LaunchpadState {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return EMPTY_LAUNCHPAD_STATE;
    }

    const launchpad = (settings as Record<string, unknown>).launchpadState;
    return this.normalizeLaunchpadState(launchpad);
  }

  private async ensurePrimaryProgram() {
    const partition = this.request.partition;
    const primary = await this.prisma.program.findFirst({
      where: {
        slug: partition.primaryProgramSlug,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (primary) {
      return primary;
    }

    const organization = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { slug: partition.organizationSlug },
          { name: partition.organizationName },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!organization) {
      throw new NotFoundException('No organization found for launchpad state');
    }

    return this.prisma.program.create({
      data: {
        organizationId: organization.id,
        name: partition.primaryProgramName,
        slug: partition.primaryProgramSlug,
        type: ProgramType.business_directory,
        status: ProgramStatus.active,
        settings: {
          launchpadState: EMPTY_LAUNCHPAD_STATE,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private get actorOrgId(): string | undefined {
    const orgId = this.request.headers['x-org-id'];
    return typeof orgId === 'string' && orgId ? orgId : undefined;
  }

  private get isSuperAdmin(): boolean {
    return getAdminRoles(this.request).includes('super_admin');
  }

  /** org_admins may only act inside their own organization; super_admins may act anywhere. */
  private assertCanManageOrganization(organizationId: string): void {
    if (this.isSuperAdmin) return;
    if (!this.actorOrgId || this.actorOrgId !== organizationId) {
      throw new ForbiddenException('You can only manage programs in your own organization.');
    }
  }

  /**
   * Anonymous callers get a minimal, non-archived listing for the request partition's organization
   * (no settings). Signed-in admins get full records for their organization; super_admins see all.
   */
  async listPrograms(): Promise<Array<Program | Pick<Program, 'id' | 'name' | 'slug' | 'type' | 'status'>>> {
    if (this.actorOrgId) {
      return this.prisma.program.findMany({
        where: this.isSuperAdmin ? {} : { organizationId: this.actorOrgId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.program.findMany({
      where: {
        organization: { slug: this.request.partition.organizationSlug },
        status: { not: ProgramStatus.archived },
        type: { not: ProgramType.suite_app },
      },
      select: { id: true, name: true, slug: true, type: true, status: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createProgram(dto: CreateProgramDto): Promise<Program> {
    if (dto.type === ProgramType.suite_app) {
      throw new BadRequestException('Suite catalog programs are managed through /suite/programs.');
    }
    this.assertCanManageOrganization(dto.organizationId);
    return this.prisma.program.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        slug: dto.slug,
        type: dto.type,
        status: dto.status,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateProgram(programId: string, dto: UpdateProgramDto): Promise<Program> {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('Program not found.');
    this.assertCanManageOrganization(program.organizationId);
    if (program.type === ProgramType.suite_app) {
      throw new BadRequestException('Suite catalog programs are managed through /suite/programs.');
    }
    return this.prisma.program.update({
      where: { id: programId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.settings ? { settings: dto.settings as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async getLaunchpadState(): Promise<LaunchpadState> {
    const partition = this.request.partition;
    const primary = await this.prisma.program.findFirst({
      where: {
        slug: partition.primaryProgramSlug,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        settings: true,
      },
    });

    if (!primary) {
      return EMPTY_LAUNCHPAD_STATE;
    }

    return this.extractLaunchpadState(primary.settings);
  }

  async upsertLaunchpadState(dto: UpsertLaunchpadStateDto): Promise<LaunchpadState> {
    const primary = await this.ensurePrimaryProgram();
    this.assertCanManageOrganization(primary.organizationId);
    const currentSettings =
      primary.settings && typeof primary.settings === 'object' && !Array.isArray(primary.settings)
        ? (primary.settings as Record<string, unknown>)
        : {};

    const nextState = this.normalizeLaunchpadState({
      custom: dto.custom ?? [],
      hiddenIds: dto.hiddenIds ?? [],
    });

    await this.prisma.program.update({
      where: { id: primary.id },
      data: {
        settings: {
          ...currentSettings,
          launchpadState: nextState,
        } as Prisma.InputJsonValue,
      },
    });

    return nextState;
  }
}
