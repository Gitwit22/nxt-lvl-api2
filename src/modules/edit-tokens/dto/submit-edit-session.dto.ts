import { IsObject, IsString } from 'class-validator';

export class SubmitEditSessionDto {
  @IsString()
  token!: string;

  @IsObject()
  updates!: Record<string, unknown>;
}
