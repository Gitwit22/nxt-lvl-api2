import { AdminRole } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;
}
