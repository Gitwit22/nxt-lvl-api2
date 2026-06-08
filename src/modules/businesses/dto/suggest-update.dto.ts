import { IsObject, IsOptional, IsString } from 'class-validator';

export class SuggestUpdateDto {
  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestedByName?: string;

  @IsOptional()
  @IsString()
  requestedByEmail?: string;
}
