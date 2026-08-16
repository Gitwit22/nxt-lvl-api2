import { IsISO8601, IsObject, IsOptional } from 'class-validator';

export class SubmitPublicFormDto {
  @IsObject()
  responses!: Record<string, string>;

  @IsOptional()
  @IsISO8601()
  startedAt?: string;
}
