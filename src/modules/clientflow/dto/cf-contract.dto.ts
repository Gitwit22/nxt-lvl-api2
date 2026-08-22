import { IsString, IsOptional } from 'class-validator';

export class CreateCfContractDto {
  @IsOptional() @IsString() enrollmentId?: string;
  @IsString() programId!: string;
  @IsOptional() @IsString() termsId?: string;
  @IsString() contractType!: string;
  @IsOptional() @IsString() status?: string;
  @IsString() content!: string;
}

export class UpdateCfContractDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() sentAt?: string;
  @IsOptional() @IsString() signedAt?: string;
}
