import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { BusinessSubmissionsModule } from '../business-submissions/business-submissions.module';
import { ChangeRequestsModule } from '../change-requests/change-requests.module';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
  imports: [BusinessesModule, BusinessSubmissionsModule, ChangeRequestsModule],
  controllers: [ProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
