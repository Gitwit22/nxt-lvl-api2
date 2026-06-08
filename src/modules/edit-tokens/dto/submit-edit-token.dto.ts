import { IsObject } from 'class-validator';

export class SubmitEditTokenDto {
  @IsObject()
  payload!: Record<string, unknown>;
}
