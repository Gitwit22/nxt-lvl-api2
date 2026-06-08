import { Injectable } from '@nestjs/common';
import { Prisma, Program } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProgramDto } from './dto/create-program.dto';

@Injectable()
export class ProgramsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
