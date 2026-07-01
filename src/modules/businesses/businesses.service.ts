import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { RequestEditLinkDto } from './dto/request-edit-link.dto';
import { SuggestUpdateDto } from './dto/suggest-update.dto';
import { randomBytes, createHash } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';

const EDIT_LINK_RESPONSE_MESSAGE =
  'If this email matches our records, an update link has been sent.';

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  createBusiness(dto: CreateBusinessDto) {
    return this.prisma.business.create({
      data: {
        ...dto,
      },
    });
  }

  async listPublishedByProgramSlug(programSlug: string) {
    const program = await this.prisma.program.findFirst({ where: { slug: programSlug } });
    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    return this.prisma.business.findMany({
      where: {
        programId: program.id,
        status: 'published',
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getPublishedBySlug(programSlug: string, businessSlug: string) {
    const business = await this.prisma.business.findFirst({
      where: {
        slug: businessSlug,
        status: 'published',
        program: {
          slug: programSlug,
        },
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    return business;
  }

  async listCategoriesByProgramSlug(programSlug: string) {
    const program = await this.prisma.program.findFirst({ where: { slug: programSlug } });
    if (!program) {
      throw new NotFoundException('Program not found.');
    }

    return this.prisma.businessCategory.findMany({
      where: { programId: program.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async suggestUpdate(businessSlug: string, dto: SuggestUpdateDto) {
    const business = await this.prisma.business.findFirst({ where: { slug: businessSlug } });
    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    return this.prisma.businessChangeRequest.create({
      data: {
        businessId: business.id,
        payload: dto.payload as Prisma.InputJsonValue,
        requestedByName: dto.requestedByName,
        requestedByEmail: dto.requestedByEmail,
      },
    });
  }

  async requestEditLink(
    businessRef: string,
    dto: RequestEditLinkDto,
    meta?: { ipAddress?: string | undefined; userAgent?: string | string[] | undefined },
  ) {
    const business =
      (await this.prisma.business.findUnique({ where: { id: businessRef } })) ??
      (await this.prisma.business.findFirst({ where: { slug: businessRef } }));

    if (!business) {
      return { message: EDIT_LINK_RESPONSE_MESSAGE };
    }

    return this.requestEditLinkForBusiness(business, dto, meta);
  }

  private async requestEditLinkForBusiness(
    business: { id: string; name: string; email: string | null },
    dto: RequestEditLinkDto,
    meta?: { ipAddress?: string | undefined; userAgent?: string | string[] | undefined },
  ) {
    const businessEmail = normalizeEmail(business.email);
    const requestedEmail = normalizeEmail(dto.email);

    if (!businessEmail || !requestedEmail || requestedEmail !== businessEmail) {
      return { message: EDIT_LINK_RESPONSE_MESSAGE };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.businessEditToken.updateMany({
        where: {
          businessId: business.id,
          usedAt: null,
          expiresAt: { gt: now },
          purpose: 'BUSINESS_UPDATE',
          source: 'owner_request',
        },
        data: { usedAt: now },
      });

      await tx.businessEditToken.create({
        data: {
          businessId: business.id,
          tokenHash,
          purpose: 'BUSINESS_UPDATE',
          requestedForEmail: businessEmail,
          requestedByEmail: requestedEmail,
          source: 'owner_request',
          ipAddress: meta?.ipAddress,
          userAgent: Array.isArray(meta?.userAgent) ? meta?.userAgent.join(', ') : meta?.userAgent,
          expiresAt,
        },
      });
    });

    await this.notifications
      .sendEditLink({
        to: business.email!,
        businessName: business.name,
        token,
        expiresAt,
      })
      .catch(() => undefined);

    return { message: EDIT_LINK_RESPONSE_MESSAGE };
  }
}
