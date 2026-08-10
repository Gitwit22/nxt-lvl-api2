import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateCfTermsDto {
  @IsString() programId!: string;
  @IsString() supportType!: string;
  @IsOptional() @IsNumber() fundingAmount?: number;
  @IsOptional() @IsString() resourceDescription?: string;
  @IsOptional() @IsNumber() grantAmount?: number;
  @IsOptional() @IsNumber() loanAmount?: number;
  @IsOptional() @IsNumber() investmentAmount?: number;
  @IsOptional() @IsNumber() forgivableAmount?: number;
  @IsOptional() @IsBoolean() repaymentRequired?: boolean;
  @IsOptional() @IsString() repaymentSchedule?: string;
  @IsOptional() @IsString() interestDescription?: string;
  @IsOptional() @IsString() milestones?: string;
  @IsOptional() @IsString() reportingRequirements?: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsString() monitoringFrequency?: string;
  @IsOptional() @IsString() specialConditions?: string;
  @IsOptional() @IsString() approvalStatus?: string;
}

export class UpdateCfTermsDto {
  @IsOptional() @IsString() approvalStatus?: string;
  @IsOptional() @IsNumber() fundingAmount?: number;
  @IsOptional() @IsString() milestones?: string;
  @IsOptional() @IsString() specialConditions?: string;
}
