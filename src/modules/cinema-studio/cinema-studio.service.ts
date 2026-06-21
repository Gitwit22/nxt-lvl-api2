import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CinemaStudioService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(workspaceId: string) {
    return this.prisma.cinemaStudioState.findUnique({
      where: { workspaceId },
      select: {
        workspaceId: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertState(workspaceId: string, state: Record<string, unknown>) {
    return this.prisma.cinemaStudioState.upsert({
      where: { workspaceId },
      update: {
        state: state as Prisma.InputJsonValue,
      },
      create: {
        workspaceId,
        state: state as Prisma.InputJsonValue,
      },
      select: {
        workspaceId: true,
        state: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
