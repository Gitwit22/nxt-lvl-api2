import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { verify } from 'jsonwebtoken';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { PrismaAuthRepository } from './infrastructure/prisma-auth-repository';
import type { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import type { ConsoleAuditLogger } from './infrastructure/console-audit-logger';

describe('AuthService session lifecycle', () => {
  const originalJwtSecret = process.env['JWT_SECRET'];
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    authSession: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const passwordHasher = {
    compare: jest.fn(),
    hash: jest.fn(),
  };
  const request = {
    partition: { slug: 'clientflow', authIssuer: 'clientflow-api' },
  } as PartitionRequest;

  function createService() {
    return new AuthService(
      request,
      prisma as unknown as PrismaService,
      {} as PrismaAuthRepository,
      passwordHasher as unknown as BcryptPasswordHasher,
      {} as ConsoleAuditLogger,
    );
  }

  beforeAll(() => {
    process.env['JWT_SECRET'] = 'test-secret-that-is-at-least-thirty-two-characters';
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env['JWT_SECRET'];
    else process.env['JWT_SECRET'] = originalJwtSecret;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rotates the refresh hash and jti before issuing a new access token', async () => {
    const refreshToken = 'session-1.original-secret';
    prisma.authSession.findFirst.mockResolvedValue({
      id: 'session-1',
      adminUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'org_admin',
        organizationId: 'org-1',
      },
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    const result = await createService().refresh(refreshToken);
    const update = prisma.authSession.updateMany.mock.calls[0][0];
    const payload = verify(result.accessToken, process.env['JWT_SECRET']!, {
      issuer: 'clientflow-api',
    }) as Record<string, unknown>;

    expect(result.refreshToken).toMatch(/^session-1\./);
    expect(result.refreshToken).not.toBe(refreshToken);
    expect(update.where.refreshTokenHash).toBe(
      createHash('sha256').update(refreshToken).digest('hex'),
    );
    expect(update.data.refreshTokenHash).toBe(
      createHash('sha256').update(result.refreshToken).digest('hex'),
    );
    expect(payload['jti']).toBe(update.data.jti);
    expect(payload['organizationId']).toBe('org-1');
    expect(payload['appPartition']).toBe('clientflow');
  });

  it('rejects a refresh token that loses the rotation race', async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      id: 'session-1',
      adminUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'reviewer',
        organizationId: 'org-1',
      },
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(createService().refresh('session-1.replayed-secret')).rejects.toThrow(
      new UnauthorizedException('Refresh session was already used.'),
    );
  });

  it('revokes the matching refresh session on logout', async () => {
    const refreshToken = 'session-1.logout-secret';
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await createService().logout(refreshToken);

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'session-1',
        refreshTokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('updates the password and revokes every active session', async () => {
    prisma.adminUser.findUnique.mockResolvedValue({ passwordHash: 'old-hash' });
    prisma.adminUser.update.mockReturnValue(Promise.resolve({}));
    prisma.authSession.updateMany.mockReturnValue(Promise.resolve({ count: 2 }));
    prisma.$transaction.mockResolvedValue([]);
    passwordHasher.compare.mockResolvedValue(true);
    passwordHasher.hash.mockResolvedValue('new-hash');

    await createService().changePassword('admin-1', {
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { adminUserId: 'admin-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});