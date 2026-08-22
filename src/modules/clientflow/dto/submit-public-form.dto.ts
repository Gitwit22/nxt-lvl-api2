import { IsArray, IsISO8601, IsObject, IsOptional, IsString } from 'class-validator';

export type PublicFormResponseValue = string | string[] | boolean | number | null;

export class SubmitPublicFormDto {
  @IsObject()
  coreResponses!: Record<string, PublicFormResponseValue>;

  @IsObject()
  programResponses!: Record<string, Record<string, PublicFormResponseValue>>;

  @IsString()
  idempotencyKey!: string;

  @IsString()
  configurationToken!: string;

  @IsArray()
  @IsString({ each: true })
  selectedProgramIds!: string[];

  @IsOptional()
  @IsISO8601()
  startedAt?: string;
}
