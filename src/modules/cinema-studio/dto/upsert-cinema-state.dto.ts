import { IsObject } from 'class-validator';

export class UpsertCinemaStateDto {
  @IsObject()
  state!: Record<string, unknown>;
}
