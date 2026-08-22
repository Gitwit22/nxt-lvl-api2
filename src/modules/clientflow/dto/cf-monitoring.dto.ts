import { IsString, IsOptional } from 'class-validator';

export class CreateCfMonitoringDto {
  @IsOptional() @IsString() enrollmentId?: string;
  @IsString() programId!: string;
  @IsString() type!: string;
  @IsString() dueDate!: string;
  @IsOptional() @IsString() status?: string;
  @IsString() assignedStaff!: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCfMonitoringDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() completedAt?: string;
}
