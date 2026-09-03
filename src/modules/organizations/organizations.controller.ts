import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { OrgAdminGuard } from '../../common/guards/org-admin.guard';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrgSettingsDto } from './dto/update-org-settings.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(AdminJwtGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get(':orgId/settings')
  getSettings(@Param('orgId') orgId: string) {
    return this.organizationsService.getSettings(orgId);
  }

  @Patch(':orgId/settings')
  @UseGuards(OrgAdminGuard)
  updateSettings(@Param('orgId') orgId: string, @Body() dto: UpdateOrgSettingsDto) {
    return this.organizationsService.updateSettings(orgId, dto);
  }

  @Get(':orgId/members')
  listMembers(@Param('orgId') orgId: string) {
    return this.organizationsService.listMembers(orgId);
  }

  @Post(':orgId/invitations')
  @UseGuards(OrgAdminGuard)
  inviteMember(@Param('orgId') orgId: string, @Body() dto: InviteMemberDto) {
    return this.organizationsService.inviteMember(orgId, dto);
  }

  @Patch(':orgId/members/:memberId/role')
  @UseGuards(OrgAdminGuard)
  updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(orgId, memberId, dto);
  }

  @Post(':orgId/members/:memberId/disable')
  @UseGuards(OrgAdminGuard)
  disableMember(@Param('orgId') orgId: string, @Param('memberId') memberId: string) {
    return this.organizationsService.disableMember(orgId, memberId);
  }

  @Post(':orgId/members/:memberId/enable')
  @UseGuards(OrgAdminGuard)
  enableMember(@Param('orgId') orgId: string, @Param('memberId') memberId: string) {
    return this.organizationsService.enableMember(orgId, memberId);
  }
}
