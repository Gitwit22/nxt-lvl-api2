import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  function createController(primaryReady: boolean) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ ready: primaryReady }]) };
    return {
      controller: new HealthController(prisma as unknown as PrismaService),
      prisma,
    };
  }

  it('reports healthy when the schema is ready', async () => {
    const { controller, prisma } = createController(true);

    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports liveness without querying the database', () => {
    const { controller, prisma } = createController(false);

    expect(controller.getLiveness()).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects a deployment with a missing schema dependency', async () => {
    const { controller } = createController(false);

    await expect(controller.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});