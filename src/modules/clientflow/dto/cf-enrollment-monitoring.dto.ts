import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CfMonitoringComplianceStatus,
  CfMonitoringFrequency,
} from '../../../generated/clientflow';

export class CreateCfEnrollmentMonitoringDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(CfMonitoringFrequency) frequency!: CfMonitoringFrequency;
  @ValidateIf((dto: CreateCfEnrollmentMonitoringDto) => dto.frequency === CfMonitoringFrequency.custom)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customIntervalDays?: number;
  @IsOptional() @Type(() => Number) @IsNumber() expectedValue?: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() nextReviewAt?: string;
  @IsOptional() @IsString() assignedReviewerId?: string;
  @IsOptional() @IsBoolean() evidenceRequired?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class RecordCfEnrollmentMonitoringResultDto {
  @IsOptional() @Type(() => Number) @IsNumber() actualValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() expectedValue?: number;
  @IsOptional() @IsString() unit?: string;
  @IsEnum(CfMonitoringComplianceStatus)
  complianceStatus!: CfMonitoringComplianceStatus;
  @IsOptional() @IsString() reviewedAt?: string;
  @IsOptional() @IsString() nextReviewAt?: string;
  @IsOptional() @IsBoolean() followUpRequired?: boolean;
  @IsOptional() @IsString() notes?: string;
}