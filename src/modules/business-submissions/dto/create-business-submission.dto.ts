import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateBusinessSubmissionDto {
  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  submittedByName?: string;

  @IsOptional()
  @IsString()
  submittedByEmail?: string;

  @IsOptional()
  @IsString()
  submittedByPhone?: string;
}
