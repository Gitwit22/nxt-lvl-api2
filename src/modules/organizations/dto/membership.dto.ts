import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { OrganizationRole } from '../../common/types/roles';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}

export class MemberResponseDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationRole: OrganizationRole;
  platformRole?: string;
  isActive: boolean;
  invitedAt: Date;
  joinedAt?: Date;
  lastLoginAt?: Date;
}
