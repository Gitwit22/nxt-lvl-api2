import { Injectable, OnModuleInit, Scope } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable({ scope: Scope.REQUEST })
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      datasourceUrl: process.env['DATABASE_URL'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
