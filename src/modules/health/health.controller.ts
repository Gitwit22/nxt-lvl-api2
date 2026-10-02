import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async getHealth() {
    const [primaryRows] = await Promise.all([
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
    ]);
    if (!primaryRows[0]?.ready) {
      throw new ServiceUnavailableException('Database schema is not ready.');
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
