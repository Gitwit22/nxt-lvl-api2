import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientflowPrisma: ClientflowPrismaService,
  ) {}

  @Get()
  async getHealth() {
    const [primaryRows, clientflowRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ ready: boolean }>>`
        SELECT
          to_regclass('public."Organization"') IS NOT NULL
          AND to_regclass('public."AdminUser"') IS NOT NULL
          AND to_regclass('public."AdminInvitation"') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'AdminUser'
              AND column_name = 'jobTitle'
          ) AS ready
      `,
      this.clientflowPrisma.$queryRaw<Array<{ ready: boolean }>>`
        SELECT
          to_regclass('public."CfFormAssignment"') IS NOT NULL
          AND to_regclass('public."CfIntakeSubmission"') IS NOT NULL
          AND to_regclass('public."CfIntakeSubmissionProgram"') IS NOT NULL
          AND to_regclass('public."CfNotification"') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'CfIntakeSubmissionProgram'
              AND column_name = 'responsePayload'
          ) AS ready
      `,
    ]);
    if (!primaryRows[0]?.ready || !clientflowRows[0]?.ready) {
      throw new ServiceUnavailableException('Database schema is not ready.');
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
