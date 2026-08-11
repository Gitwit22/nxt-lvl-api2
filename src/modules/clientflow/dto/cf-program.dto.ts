import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateCfProgramDto {
  @IsOptional() @IsString() id?: string;
  @IsString() name!: string;
  @IsString() description!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsString() defaultFormTemplateId!: string;
  @IsString() defaultMonitoringFrequency!: string;
  @IsString() defaultContractTemplateId!: string;
  @IsOptional() @IsArray() defaultWorkflow?: string[];
  @IsOptional() @IsArray() requiredDocuments?: string[];
  @IsOptional() @IsArray() statusPipeline?: string[];
}

export class UpdateCfProgramDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() defaultFormTemplateId?: string;
  @IsOptional() @IsString() defaultMonitoringFrequency?: string;
  @IsOptional() @IsString() defaultContractTemplateId?: string;
  @IsOptional() @IsArray() defaultWorkflow?: string[];
  @IsOptional() @IsArray() requiredDocuments?: string[];
  @IsOptional() @IsArray() statusPipeline?: string[];
}
