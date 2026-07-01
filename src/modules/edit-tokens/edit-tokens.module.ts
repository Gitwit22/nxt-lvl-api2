import { Module } from '@nestjs/common';
import { EditTokensController } from './edit-tokens.controller';
import { EditTokensService } from './edit-tokens.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
	imports: [NotificationsModule],
	controllers: [EditTokensController],
	providers: [EditTokensService],
	exports: [EditTokensService],
})
export class EditTokensModule {}
