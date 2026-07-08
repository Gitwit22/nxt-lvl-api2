import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Program, ProgramStatus, ProgramType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpsertLaunchpadStateDto } from './dto/upsert-launchpad-state.dto';
import programPartition from '../../config/program.partition.json';

type LaunchpadState = {
  custom: unknown[];
  hiddenIds: string[];
};

const EMPTY_LAUNCHPAD_STATE: LaunchpadState = {
  custom: [],
  hiddenIds: [],
};

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const primary = await this.prisma.program.findFirst({
      where: {
        slug: programPartition.primaryProgramSlug,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (primary) {
      return primary;
    }

    const organization = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { slug: programPartition.organizationSlug },
          { name: programPartition.organizationName },
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
        name: programPartition.primaryProgramName,
        slug: programPartition.primaryProgramSlug,
        type: ProgramType.business_directory,
        status: ProgramStatus.active,
        settings: {
          launchpadState: EMPTY_LAUNCHPAD_STATE,
        } as Prisma.InputJsonValue,
      },
    });
  }

  listPrograms(): Promise<Program[]> {
    return this.prisma.program.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  createProgram(dto: CreateProgramDto): Promise<Program> {
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

  async getLaunchpadState(): Promise<LaunchpadState> {
    const primary = await this.prisma.program.findFirst({
      where: {
        slug: programPartition.primaryProgramSlug,
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
