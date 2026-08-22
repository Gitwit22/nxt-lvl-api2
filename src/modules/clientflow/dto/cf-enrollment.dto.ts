import { CfEnrollmentStatus } from '../../../generated/clientflow';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCfEnrollmentDto {
  @IsString()
  clientId!: string;

  @IsString()
  programId!: string;

  @IsOptional()
  @IsEnum(CfEnrollmentStatus)
  status?: CfEnrollmentStatus;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  assignedStaff?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class UpdateCfEnrollmentDto {
  @IsOptional()
  @IsEnum(CfEnrollmentStatus)
  status?: CfEnrollmentStatus;

  @IsOptional()
  @IsString()
  statusReason?: string;

  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  assignedStaff?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercentage?: number;

  @IsOptional()
  @IsString()
  nextAction?: string;

  @IsOptional()
  @IsDateString()
  nextActionDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
