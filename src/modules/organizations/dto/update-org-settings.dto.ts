import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';

export class NotificationTemplateTogglesDto {
  @IsBoolean()
  @IsOptional()
  programInvite?: boolean;

  @IsBoolean()
  @IsOptional()
  monitoringReminder?: boolean;

  @IsBoolean()
  @IsOptional()
  contractDraft?: boolean;

  @IsBoolean()
  @IsOptional()
  finalReport?: boolean;
}

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

  @ValidateNested()
  @Type(() => NotificationTemplateTogglesDto)
  @IsOptional()
  notificationTemplateToggles?: NotificationTemplateTogglesDto;
}
