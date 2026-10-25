import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { FeaturedBusinessesService } from './featured-businesses.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController],
  providers: [FeaturedBusinessesService],
})
export class AdminModule {}
