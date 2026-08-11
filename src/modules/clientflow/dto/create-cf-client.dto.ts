import { IsEmail, IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class CreateCfClientDto {
  @IsString() businessName!: string;
  @IsString() primaryContactName!: string;
  @IsEmail() email!: string;
  @IsString() phone!: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() programId?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() profileType?: string;
  @IsOptional() @IsString() relationshipType?: string;
  @IsOptional() @IsString() lifecycleStatus?: string;
  @IsString() assignedStaff!: string;
  @IsOptional() assignedUserId?: string | null;
  @IsOptional() @IsString() intakeSource?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() nextFollowUpDate?: string;
  @IsOptional() convertedAt?: string | null;
  @IsOptional() @IsBoolean() isDemo?: boolean;
  @IsObject() intake!: Record<string, unknown>;
  @IsOptional() @IsObject() snapchat?: Record<string, unknown> | null;
}
