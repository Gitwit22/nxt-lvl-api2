import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBusinessSubmissionDto } from './dto/create-business-submission.dto';

@Injectable()
export class BusinessSubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubmission(programSlug: string, dto: CreateBusinessSubmissionDto) {
    const program = await this.prisma.program.findFirst({ where: { slug: programSlug } });
    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    return this.prisma.businessSubmission.create({
      data: {
        programId: program.id,
        payload: dto.payload as Prisma.InputJsonValue,
        submittedByName: dto.submittedByName,
        submittedByEmail: dto.submittedByEmail,
        submittedByPhone: dto.submittedByPhone,
      },
    });
  }

  listPending() {
    return this.prisma.businessSubmission.findMany({
      where: { status: 'pending_review' },
      orderBy: { createdAt: 'desc' },
    });
  }
}
