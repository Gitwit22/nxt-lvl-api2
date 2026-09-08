import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import type { PartitionRequest } from '../interfaces/partition-request.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import { AdminJwtGuard } from './admin-jwt.guard';

describe('AdminJwtGuard', () => {
  const originalJwtSecret = process.env['JWT_SECRET'];
  const prisma = { authSession: { findFirst: jest.fn() } };
  const guard = new AdminJwtGuard(prisma as unknown as PrismaService);

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

  function context(
    organizationId = 'org-1',
    tokenPartition = 'clientflow',
  ): { context: ExecutionContext; request: PartitionRequest } {
    const token = sign(
      {
        email: 'admin@example.com',
        roles: ['org_admin'],
        sessionId: 'session-1',
        jti: 'jti-1',
        organizationId,
        appPartition: tokenPartition,
      },
      process.env['JWT_SECRET']!,
      { subject: 'admin-1', issuer: 'clientflow-api', expiresIn: '15m' },
    );
    const request = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
      partition: { slug: 'clientflow', authIssuer: 'clientflow-api' },
    } as PartitionRequest;
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext,
    };
  }

  it('accepts an active session and derives organization headers from the database', async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      adminUser: { organizationId: 'org-1' },
    });
    const testContext = context();

    await expect(guard.canActivate(testContext.context)).resolves.toBe(true);

    expect(testContext.request.headers['x-admin-id']).toBe('admin-1');
    expect(testContext.request.headers['x-session-id']).toBe('session-1');
    expect(testContext.request.headers['x-org-id']).toBe('org-1');
  });

  it('rejects a revoked or missing session', async () => {
    prisma.authSession.findFirst.mockResolvedValue(null);

    await expect(guard.canActivate(context().context)).rejects.toThrow(
      new UnauthorizedException('Authenticated session is no longer active.'),
    );
  });

  it('rejects a token whose organization differs from the active account', async () => {
    prisma.authSession.findFirst.mockResolvedValue({
      adminUser: { organizationId: 'org-2' },
    });

    await expect(guard.canActivate(context('org-1').context)).rejects.toThrow(
      new UnauthorizedException('Authenticated organization is invalid.'),
    );
  });

  it('rejects a token issued for another application partition', async () => {
    await expect(guard.canActivate(context('org-1', 'fba-app').context)).rejects.toThrow(
      new UnauthorizedException('Authenticated partition is invalid.'),
    );
    expect(prisma.authSession.findFirst).not.toHaveBeenCalled();
  });
});