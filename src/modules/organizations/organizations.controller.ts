import { Controller, Get, Param, UseGuards, Headers } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(AdminJwtGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Get organization settings loaded after login
   * Frontend should call this after successful auth to load org config
   */
  @Get(':organizationId/settings')
  async getSettings(@Param('organizationId') organizationId: string) {
    return this.organizationsService.getOrganizationSettings(organizationId);
  }

  /**
   * List all admin users in the organization
   * Only accessible by org admins and above
   */
  @Get(':organizationId/admins')
  async listAdmins(@Param('organizationId') organizationId: string) {
    return this.organizationsService.listAdminUsers(organizationId);
  }

  /**
   * Get specific admin user details
   */
  @Get(':organizationId/admins/:adminId')
  async getAdmin(
    @Param('organizationId') organizationId: string,
    @Param('adminId') adminId: string,
  ) {
    return this.organizationsService.getAdminUser(organizationId, adminId);
  }
}
