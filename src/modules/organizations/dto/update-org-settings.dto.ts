import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateOrgSettingsDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  replyToEmail?: string;

  @IsString()
  @IsOptional()
  defaultMonitoringFrequency?: string;
}
