import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** The Browse page's default grid holds 9 cards; featured slots fill it from the top. */
export const MAX_FEATURED_BUSINESSES = 9;

export type FeaturedBusinessSummary = {
  id: string;
  name: string;
  featuredRank: number;
};

/** Validate the shape of an ordered featured selection. Throws BadRequestException. */
export function parseFeaturedSelection(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException('businessIds must be an array of business IDs.');
  }
  if (raw.some((id) => typeof id !== 'string' || id.trim().length === 0)) {
    throw new BadRequestException('businessIds must contain only non-empty strings.');
  }
  const ids = (raw as string[]).map((id) => id.trim());
  if (ids.length > MAX_FEATURED_BUSINESSES) {
    throw new BadRequestException(`At most ${MAX_FEATURED_BUSINESSES} businesses can be featured.`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException('businessIds must not contain duplicates.');
  }
  return ids;
}

@Injectable()
export class FeaturedBusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a program the signed-in admin's organization owns. */
  private async findProgramForAdmin(programSlug: string, adminOrgId: string | undefined) {
    const program = await this.prisma.program.findFirst({ where: { slug: programSlug } });
    if (!program) throw new NotFoundException('Program not found.');
    if (!adminOrgId || program.organizationId !== adminOrgId) {
      throw new ForbiddenException('You do not have access to this program.');
    }
    return program;
  }

  async list(programSlug: string, adminOrgId: string | undefined): Promise<FeaturedBusinessSummary[]> {
    const program = await this.findProgramForAdmin(programSlug, adminOrgId);
    return this.listForProgram(program.id);
  }

  /**
   * Replace the program's featured selection with `rawIds`, in order (index 0 = rank 1).
   * All-or-nothing: either every rank is rewritten or nothing changes.
   */
  async replace(
    programSlug: string,
    adminOrgId: string | undefined,
    rawIds: unknown,
  ): Promise<FeaturedBusinessSummary[]> {
    const ids = parseFeaturedSelection(rawIds);
    const program = await this.findProgramForAdmin(programSlug, adminOrgId);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (ids.length > 0) {
          const eligible = await tx.business.findMany({
            where: { id: { in: ids }, programId: program.id, status: 'published' },
            select: { id: true },
          });
          const eligibleIds = new Set(eligible.map((b) => b.id));
          const ineligible = ids.filter((id) => !eligibleIds.has(id));
          if (ineligible.length > 0) {
            throw new BadRequestException(
              `Only published businesses in this program can be featured. Ineligible: ${ineligible.join(', ')}`,
            );
          }
        }

        // Clear first so the (programId, featuredRank) unique index never sees two rows on one rank.
        await tx.business.updateMany({
          where: { programId: program.id, featuredRank: { not: null } },
          data: { featuredRank: null },
        });
        for (const [index, id] of ids.entries()) {
          await tx.business.update({ where: { id }, data: { featuredRank: index + 1 } });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('The featured list was changed at the same time. Reload and try again.');
      }
      throw error;
    }

    return this.listForProgram(program.id);
  }

  private async listForProgram(programId: string): Promise<FeaturedBusinessSummary[]> {
    const rows = await this.prisma.business.findMany({
      where: { programId, featuredRank: { not: null } },
      orderBy: { featuredRank: 'asc' },
      select: { id: true, name: true, featuredRank: true },
    });
    return rows.map((row) => ({ id: row.id, name: row.name, featuredRank: row.featuredRank as number }));
  }
}
