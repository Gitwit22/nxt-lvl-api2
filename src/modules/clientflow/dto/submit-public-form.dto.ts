import { IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitPublicFormDto {
  @IsObject()
  responses!: Record<string, string>;

  @IsOptional()
  @IsString()
  startedAt?: string;
}
