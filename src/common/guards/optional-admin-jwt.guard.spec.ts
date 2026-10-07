import type { ExecutionContext } from '@nestjs/common';
import type { PartitionRequest } from '../interfaces/partition-request.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import { OptionalAdminJwtGuard } from './optional-admin-jwt.guard';

describe('OptionalAdminJwtGuard', () => {
  const prisma = { authSession: { findFirst: jest.fn() } };
  const guard = new OptionalAdminJwtGuard(prisma as unknown as PrismaService);

  function contextFor(headers: Record<string, string>) {
    const request = {
      headers,
      cookies: {},
      partition: { slug: 'nxt-lvl-suites', authIssuer: 'nxt-lvl-suites-api2' },
    } as unknown as PartitionRequest;
    return { request, context: { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext };
  }

  it('lets anonymous requests through', async () => {
    const { context } = contextFor({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('strips client-supplied identity headers so roles cannot be spoofed', async () => {
    const { request, context } = contextFor({
      'x-admin-roles': 'super_admin',
      'x-org-id': 'org-1',
      'x-admin-id': 'attacker',
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.headers['x-admin-roles']).toBeUndefined();
    expect(request.headers['x-org-id']).toBeUndefined();
    expect(request.headers['x-admin-id']).toBeUndefined();
  });

  it('treats an invalid token as anonymous instead of failing the request', async () => {
    const { request, context } = contextFor({ authorization: 'Bearer not-a-jwt', 'x-admin-roles': 'super_admin' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.headers['x-admin-roles']).toBeUndefined();
  });
});
