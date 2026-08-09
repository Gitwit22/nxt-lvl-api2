import { AdminRole } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsEnum(AdminRole)
  @IsNotEmpty()
  role!: AdminRole;
}
