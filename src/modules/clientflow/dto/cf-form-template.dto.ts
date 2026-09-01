import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const FORM_TEMPLATE_SCOPES = ['master_core', 'program_section', 'legacy'] as const;

export class CreateCfFormTemplateDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() programId?: string | null;
  @IsOptional() @IsIn(FORM_TEMPLATE_SCOPES) scope?: typeof FORM_TEMPLATE_SCOPES[number];
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @Type(() => Object) fields?: unknown[];
  @IsOptional() @IsString() emailTemplate?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsInt() @Min(1) dueInDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCfFormTemplateDto {
  @IsOptional() @IsString() programId?: string | null;
  @IsOptional() @IsIn(FORM_TEMPLATE_SCOPES) scope?: typeof FORM_TEMPLATE_SCOPES[number];
  @IsOptional() @IsInt() @Min(1) version?: number;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @Type(() => Object) fields?: unknown[];
  @IsOptional() @IsString() emailTemplate?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsInt() @Min(1) dueInDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
