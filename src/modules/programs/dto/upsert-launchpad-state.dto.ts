import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpsertLaunchpadStateDto {
  @IsOptional()
  @IsArray()
  custom?: unknown[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenIds?: string[];
}
