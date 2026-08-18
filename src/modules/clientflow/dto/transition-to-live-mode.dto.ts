import { IsString, MinLength } from 'class-validator';

export class TransitionToLiveModeDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  confirmation!: string;
}
