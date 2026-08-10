import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateCfClientDto {
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() primaryContactName?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() programId?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() profileType?: string;
  @IsOptional() @IsString() relationshipType?: string;
  @IsOptional() @IsString() lifecycleStatus?: string;
  @IsOptional() @IsString() assignedStaff?: string;
  @IsOptional() assignedUserId?: string | null;
  @IsOptional() @IsString() intakeSource?: string;
  @IsOptional() @IsString() nextFollowUpDate?: string;
  @IsOptional() convertedAt?: string | null;
  @IsOptional() @IsBoolean() isArchived?: boolean;
  @IsOptional() @IsString() archiveReason?: string;
  @IsOptional() @IsString() finalStatus?: string;
  @IsOptional() @IsString() archivedAt?: string;
  @IsOptional() @IsObject() intake?: Record<string, unknown>;
  @IsOptional() @IsObject() snapchat?: Record<string, unknown> | null;
}
