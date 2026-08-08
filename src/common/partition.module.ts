import { Global, Module } from '@nestjs/common';
import { PartitionService } from './services/partition.service';

@Global()
@Module({
  providers: [PartitionService],
  exports: [PartitionService],
})
export class PartitionModule {}