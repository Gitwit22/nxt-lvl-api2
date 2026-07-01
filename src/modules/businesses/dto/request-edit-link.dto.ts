import { IsEmail, IsOptional, IsString } from 'class-validator';

export class RequestEditLinkDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  businessId?: string;
}
