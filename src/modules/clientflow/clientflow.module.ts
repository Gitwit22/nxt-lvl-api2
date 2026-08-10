import { Module } from '@nestjs/common';
import { ClientflowController } from './clientflow.controller';
import { ClientflowService } from './clientflow.service';
import { PublicFormController } from './public-form.controller';
import { PublicFormService } from './public-form.service';

@Module({
  controllers: [ClientflowController, PublicFormController],
  providers: [ClientflowService, PublicFormService],
})
export class ClientflowModule {}
