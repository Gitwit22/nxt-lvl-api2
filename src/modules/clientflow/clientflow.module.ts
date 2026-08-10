import { Module } from '@nestjs/common';
import { ClientflowController } from './clientflow.controller';
import { ClientflowService } from './clientflow.service';

@Module({
  controllers: [ClientflowController],
  providers: [ClientflowService],
})
export class ClientflowModule {}
