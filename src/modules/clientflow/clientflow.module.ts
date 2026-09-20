import { Module } from '@nestjs/common';
import { ClientflowController } from './clientflow.controller';
import { ClientflowService } from './clientflow.service';
import { PublicFormController } from './public-form.controller';
import { PublicFormService } from './public-form.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrollmentService } from './enrollment.service';
import { MonitoringService } from './monitoring.service';
import { FilesModule } from '../files/files.module';
import { FormEmailDeliveryService } from './form-email-delivery.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  controllers: [ClientflowController, PublicFormController],
  providers: [
    ClientflowService,
    EnrollmentService,
    MonitoringService,
    PublicFormService,
    FormEmailDeliveryService,
  ],
})
export class ClientflowModule {}
