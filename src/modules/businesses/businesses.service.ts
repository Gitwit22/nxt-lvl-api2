import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { SuggestUpdateDto } from './dto/suggest-update.dto';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async requestEditLink(businessSlug: string) {
    const business = await this.prisma.business.findFirst({ where: { slug: businessSlug } });
    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await this.prisma.businessEditToken.create({
      data: {
        businessId: business.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token,
      expiresAt,
    };
  }
}
