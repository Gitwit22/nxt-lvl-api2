import { IsObject } from 'class-validator';

export class UpsertClipMagicStateDto {
  @IsObject()
  state!: Record<string, unknown>;
}
