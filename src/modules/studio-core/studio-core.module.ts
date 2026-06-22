import { Module } from '@nestjs/common';
import { StudioCoreController } from './studio-core.controller';
import { StudioCoreService } from './studio-core.service';

@Module({
  controllers: [StudioCoreController],
  providers: [StudioCoreService],
  exports: [StudioCoreService],
})
export class StudioCoreModule {}
