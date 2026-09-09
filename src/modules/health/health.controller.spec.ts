import { ServiceUnavailableException } from '@nestjs/common';
import type { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  function createController(primaryReady: boolean, clientflowReady: boolean) {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ ready: primaryReady }]) };
    const clientflowPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ ready: clientflowReady }]),
    };
    return {
      controller: new HealthController(
        prisma as unknown as PrismaService,
        clientflowPrisma as unknown as ClientflowPrismaService,
      ),
      prisma,
      clientflowPrisma,
    };
  }

  it('reports healthy only when both schemas are ready', async () => {
    const { controller, prisma, clientflowPrisma } = createController(true, true);

    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      timestamp: expect.any(String),
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(clientflowPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a deployment with a missing ClientFlow schema dependency', async () => {
    const { controller } = createController(true, false);

    await expect(controller.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});