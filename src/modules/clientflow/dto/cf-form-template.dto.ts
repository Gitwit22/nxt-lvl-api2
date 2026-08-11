import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateCfFormTemplateDto {
  @IsOptional() @IsString() id?: string;
  @IsString() programId!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() fields?: unknown[];
  @IsOptional() @IsString() emailTemplate?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsInt() @Min(1) dueInDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCfFormTemplateDto {
  @IsOptional() @IsString() programId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() fields?: unknown[];
  @IsOptional() @IsString() emailTemplate?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsInt() @Min(1) dueInDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
