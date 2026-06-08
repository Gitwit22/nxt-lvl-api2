import { Module } from '@nestjs/common';
import { BusinessSubmissionsController } from './business-submissions.controller';
import { BusinessSubmissionsService } from './business-submissions.service';

@Module({
  controllers: [BusinessSubmissionsController],
  providers: [BusinessSubmissionsService],
  exports: [BusinessSubmissionsService],
})
export class BusinessSubmissionsModule {}
