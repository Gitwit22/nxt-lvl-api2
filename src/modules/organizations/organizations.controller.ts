import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { OrganizationAccessGuard } from '../../common/guards/organization-access.guard';
import type { AccessClaims } from '../auth/services/enhanced-jwt-token.service';
import type { OrganizationMember } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { OrganizationMembershipService } from './services/organization-membership.service';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/membership.dto';

type AuthRequest = Request & { adminUser?: AccessClaims; membership?: OrganizationMember | null };

@Controller('organizations')
@UseGuards(AdminJwtGuard, OrganizationAccessGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly membershipService: OrganizationMembershipService,
  ) {}

  // ─── Organization ────────────────────────────────────────────────────────────

  @Get(':organizationId/settings')
  getSettings(@Param('organizationId') organizationId: string) {
    return this.organizationsService.getOrganizationSettings(organizationId);
  }

  // ─── Members ─────────────────────────────────────────────────────────────────

  @Get(':organizationId/members')
  listMembers(@Param('organizationId') organizationId: string) {
    return this.membershipService.listMembers(organizationId);
  }

  @Get(':organizationId/members/:memberId')
  getMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membershipService.getMember(organizationId, memberId);
  }

  @Post(':organizationId/invitations')
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @Param('organizationId') organizationId: string,
    @Req() req: AuthRequest,
    @Body() dto: InviteMemberDto,
  ) {
    // req.membership is set by OrganizationAccessGuard (null for platform admin)
    return this.membershipService.inviteMember(organizationId, req.membership?.id ?? null, dto);
  }

  @Patch(':organizationId/members/:memberId/role')
  updateMemberRole(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthRequest,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membershipService.updateMemberRole(
      organizationId,
      req.membership?.id ?? null,
      memberId,
      dto,
      req.adminUser!,
    );
  }

  @Post(':organizationId/members/:memberId/disable')
  @HttpCode(HttpStatus.OK)
  disableMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthRequest,
  ) {
    return this.membershipService.disableMember(organizationId, req.membership?.id ?? null, memberId);
  }

  @Post(':organizationId/members/:memberId/enable')
  @HttpCode(HttpStatus.OK)
  enableMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Req() req: AuthRequest,
  ) {
    return this.membershipService.enableMember(organizationId, req.membership?.id ?? null, memberId);
  }
}

