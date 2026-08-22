import { Global, Module } from '@nestjs/common';
import { ClientflowPrismaService } from './clientflow-prisma.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, ClientflowPrismaService],
  exports: [PrismaService, ClientflowPrismaService],
})
export class PrismaModule {}
