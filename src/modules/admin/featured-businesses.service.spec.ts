import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { FeaturedBusinessesService, MAX_FEATURED_BUSINESSES, parseFeaturedSelection } from './featured-businesses.service';

type Row = { id: string; name: string; programId: string; status: string; featuredRank: number | null };

function makeService(rows: Row[], program: { id: string; organizationId: string } | null = { id: 'prog-1', organizationId: 'org-1' }) {
  const db = rows.map((r) => ({ ...r }));
  const business = {
    findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      return db
        .filter((r) => r.programId === where.programId)
        .filter((r) => (where.status ? r.status === where.status : true))
        .filter((r) => (where.id ? (where.id as { in: string[] }).in.includes(r.id) : true))
        .filter((r) => (where.featuredRank ? r.featuredRank !== null : true))
        .sort((a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0));
    }),
    updateMany: jest.fn(async ({ where }: { where: { programId: string } }) => {
      for (const r of db) if (r.programId === where.programId) r.featuredRank = null;
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: { featuredRank: number } }) => {
      const row = db.find((r) => r.id === where.id)!;
      row.featuredRank = data.featuredRank;
      return row;
    }),
  };
  const prisma = {
    program: { findFirst: jest.fn().mockResolvedValue(program) },
    business,
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      // Mirror rollback semantics: restore the snapshot when the callback throws.
      const snapshot = db.map((r) => ({ ...r }));
      try {
        return await fn({ business });
      } catch (error) {
        snapshot.forEach((r, i) => Object.assign(db[i], r));
        throw error;
      }
    }),
  };
  const service = new FeaturedBusinessesService(prisma as unknown as PrismaService);
  return { service, prisma, db };
}

const published = (id: string, rank: number | null = null): Row => ({
  id,
  name: id.toUpperCase(),
  programId: 'prog-1',
  status: 'published',
  featuredRank: rank,
});

describe('parseFeaturedSelection', () => {
  it('accepts up to the maximum, preserving order', () => {
    const ids = Array.from({ length: MAX_FEATURED_BUSINESSES }, (_, i) => `b${i}`);
    expect(parseFeaturedSelection(ids)).toEqual(ids);
  });

  it('rejects more than 9 businesses', () => {
    const ids = Array.from({ length: MAX_FEATURED_BUSINESSES + 1 }, (_, i) => `b${i}`);
    expect(() => parseFeaturedSelection(ids)).toThrow(BadRequestException);
  });

  it('rejects duplicates, non-arrays and non-string IDs', () => {
    expect(() => parseFeaturedSelection(['a', 'b', 'a'])).toThrow(/duplicates/);
    expect(() => parseFeaturedSelection('a')).toThrow(BadRequestException);
    expect(() => parseFeaturedSelection(undefined)).toThrow(BadRequestException);
    expect(() => parseFeaturedSelection(['a', 3])).toThrow(BadRequestException);
    expect(() => parseFeaturedSelection(['  '])).toThrow(BadRequestException);
  });
});

describe('FeaturedBusinessesService.replace', () => {
  it('saves the selection in order and clears businesses no longer featured', async () => {
    const { service, db } = makeService([published('a', 1), published('b', 2), published('c'), published('d')]);

    const result = await service.replace('fba-app', 'org-1', ['d', 'a', 'c']);

    expect(result.map((r) => [r.id, r.featuredRank])).toEqual([
      ['d', 1],
      ['a', 2],
      ['c', 3],
    ]);
    expect(db.find((r) => r.id === 'b')!.featuredRank).toBeNull();
  });

  it('rejects unpublished or other-program businesses and leaves the saved order untouched', async () => {
    const draft: Row = { ...published('x'), status: 'suspended' };
    const foreign: Row = { ...published('y'), programId: 'prog-2' };
    const { service, db, prisma } = makeService([published('a', 1), draft, foreign]);

    await expect(service.replace('fba-app', 'org-1', ['a', 'x', 'y'])).rejects.toThrow(/Ineligible: x, y/);
    expect(db.find((r) => r.id === 'a')!.featuredRank).toBe(1);
    expect(prisma.business.updateMany).not.toHaveBeenCalled();
  });

  it('enforces the maximum before touching the database', async () => {
    const { service, prisma } = makeService([]);
    const ids = Array.from({ length: 10 }, (_, i) => `b${i}`);

    await expect(service.replace('fba-app', 'org-1', ids)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows clearing the whole selection', async () => {
    const { service, db } = makeService([published('a', 1), published('b', 2)]);
    await expect(service.replace('fba-app', 'org-1', [])).resolves.toEqual([]);
    expect(db.every((r) => r.featuredRank === null)).toBe(true);
  });

  it("refuses admins from another organization", async () => {
    const { service, prisma } = makeService([published('a')]);
    await expect(service.replace('fba-app', 'org-2', ['a'])).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.replace('fba-app', undefined, ['a'])).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('404s for an unknown program', async () => {
    const { service } = makeService([], null);
    await expect(service.replace('missing', 'org-1', [])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a concurrent unique-rank collision to 409', async () => {
    const { service, prisma } = makeService([published('a')]);
    prisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(service.replace('fba-app', 'org-1', ['a'])).rejects.toBeInstanceOf(ConflictException);
  });
});
