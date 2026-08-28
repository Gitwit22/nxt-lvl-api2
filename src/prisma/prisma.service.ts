import { Inject, Injectable, OnModuleInit, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import type { PartitionRequest } from '../common/interfaces/partition-request.interface';

@Injectable({ scope: Scope.REQUEST })
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(@Inject(REQUEST) request: PartitionRequest) {
    super({
      datasourceUrl:
        request.partition.primaryProgramSlug === 'clientflow'
          ? process.env['CLIENTFLOW_DATABASE_URL']
          : process.env['DATABASE_URL'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
}
