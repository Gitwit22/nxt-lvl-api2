import { Module } from '@nestjs/common';
import { BusinessSubmissionsController } from './business-submissions.controller';
import { BusinessSubmissionsService } from './business-submissions.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BusinessSubmissionsController],
  providers: [BusinessSubmissionsService],
  exports: [BusinessSubmissionsService],
})
export class BusinessSubmissionsModule {}
