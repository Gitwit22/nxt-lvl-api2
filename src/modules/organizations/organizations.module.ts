import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationMembershipService } from './services/organization-membership.service';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationMembershipService, OrganizationAccessGuard],
  exports: [OrganizationsService, OrganizationMembershipService],
})
export class OrganizationsModule {}
