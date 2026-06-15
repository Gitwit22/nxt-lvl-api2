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

  async approveSubmission(submissionId: string, adminId: string) {
    const submission = await this.prisma.businessSubmission.findUnique({
      where: { id: submissionId },
      include: { program: true },
    });
    if (!submission) throw new NotFoundException('Submission not found.');

    const payload = submission.payload as Record<string, unknown>;
    const name = String(payload.name ?? 'Unnamed Business');
    const slug =
      name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') +
      '-' +
      submissionId.slice(-6);

    const [, business] = await this.prisma.$transaction([
      this.prisma.businessSubmission.update({
        where: { id: submissionId },
        data: { status: 'approved', reviewedAt: new Date(), reviewedByAdminId: adminId },
      }),
      this.prisma.business.create({
        data: {
          programId: submission.programId,
          name,
          slug,
          description: payload.description ? String(payload.description) : undefined,
          categories: payload.category ? [String(payload.category)] : [],
          phone: payload.phone ? String(payload.phone) : undefined,
          email: payload.email ? String(payload.email) : undefined,
          website: payload.website ? String(payload.website) : undefined,
          city: payload.city ? String(payload.city) : undefined,
          state: payload.state ? String(payload.state) : undefined,
          status: 'published',
        },
      }),
    ]);

    return business;
  }

  async rejectSubmission(submissionId: string, adminId: string) {
    const submission = await this.prisma.businessSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new NotFoundException('Submission not found.');

    return this.prisma.businessSubmission.update({
      where: { id: submissionId },
      data: { status: 'rejected', reviewedAt: new Date(), reviewedByAdminId: adminId },
    });
  }
}
