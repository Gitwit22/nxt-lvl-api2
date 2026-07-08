import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBusinessSubmissionDto } from './dto/create-business-submission.dto';

function withUrlProtocol(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function calculateCompletionPercentage(payload: Record<string, unknown>): number {
  let score = 0;

  const name = typeof payload.name === 'string' && payload.name.trim();
  const phone = typeof payload.phone === 'string' && payload.phone.trim();
  const email = typeof payload.email === 'string' && payload.email.trim();
  const city = typeof payload.city === 'string' && payload.city.trim();
  const state = typeof payload.state === 'string' && payload.state.trim();
  const isOwned = payload.isBlackAmericanOwned === true;

  if (name && (phone || email) && city && state && isOwned) score += 40;
  if (Array.isArray(payload.categories) ? (payload.categories as string[]).length > 0 : typeof payload.category === 'string' && (payload.category as string).trim()) score += 10;
  if (typeof payload.description === 'string' && (payload.description as string).trim()) score += 10;
  if (typeof payload.logoUrl === 'string' && (payload.logoUrl as string).trim()) score += 10;
  if (
    (typeof payload.website === 'string' && (payload.website as string).trim()) ||
    (typeof payload.facebook === 'string' && (payload.facebook as string).trim()) ||
    (typeof payload.instagram === 'string' && (payload.instagram as string).trim()) ||
    (typeof payload.linkedin === 'string' && (payload.linkedin as string).trim()) ||
    (typeof payload.tiktok === 'string' && (payload.tiktok as string).trim()) ||
    (typeof payload.youtube === 'string' && (payload.youtube as string).trim())
  ) score += 10;
  if (
    (Array.isArray(payload.services) && (payload.services as unknown[]).length > 0) ||
    (typeof payload.productsServices === 'string' && (payload.productsServices as string).trim())
  ) score += 10;
  if (payload.businessHours && typeof payload.businessHours === 'object') score += 10;

  return score;
}

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

    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? String(v) : undefined);
    const url = (v: unknown) => withUrlProtocol(str(v));
    const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
    const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const urlArr = (v: unknown): string[] =>
      arr(v)
        .map((item) => withUrlProtocol(item))
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);

    const profileCompletionPercentage = calculateCompletionPercentage(payload);

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
          description: str(payload.description),
          categories: payload.category ? [String(payload.category)] : arr(payload.categories),
          services: arr(payload.services),
          tags: arr(payload.tags),
          phone: str(payload.phone),
          email: str(payload.email),
          website: url(payload.website),
          address: str(payload.address),
          city: str(payload.city),
          state: str(payload.state),
          zip: str(payload.zip),
          isBlackAmericanOwned: bool(payload.isBlackAmericanOwned),
          ownershipConfirmedAt: payload.isBlackAmericanOwned === true ? new Date() : undefined,
          logoUrl: url(payload.logoUrl),
          coverImageUrl: url(payload.coverImageUrl),
          photoUrls: urlArr(payload.photoUrls),
          yearEstablished: num(payload.yearEstablished),
          serviceArea: str(payload.serviceArea),
          bookingLink: url(payload.bookingLink),
          facebook: url(payload.facebook),
          instagram: url(payload.instagram),
          linkedin: url(payload.linkedin),
          tiktok: url(payload.tiktok),
          youtube: url(payload.youtube),
          isOnlineOnly: bool(payload.isOnlineOnly),
          isMobile: bool(payload.isMobile),
          appointmentRequired: bool(payload.appointmentRequired),
          deliveryAvailable: bool(payload.deliveryAvailable),
          acceptingNewCustomers: bool(payload.acceptingNewCustomers),
          businessHours: payload.businessHours
            ? (payload.businessHours as Prisma.InputJsonValue)
            : undefined,
          profileCompletionPercentage,
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
