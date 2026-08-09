import { ProgramStatus } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateProgramDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(ProgramStatus)
  @IsOptional()
  status?: ProgramStatus;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
