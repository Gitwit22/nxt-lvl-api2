import { Module } from '@nestjs/common';
import { BusinessSubmissionsController } from './business-submissions.controller';
import { BusinessSubmissionsService } from './business-submissions.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [BusinessSubmissionsController],
  providers: [BusinessSubmissionsService],
  exports: [BusinessSubmissionsService],
})
export class BusinessSubmissionsModule {}
