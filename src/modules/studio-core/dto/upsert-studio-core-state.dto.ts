import { IsObject } from 'class-validator';

export class UpsertStudioCoreStateDto {
  @IsObject()
  state!: Record<string, unknown>;
}
