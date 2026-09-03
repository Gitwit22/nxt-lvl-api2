import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCfFormAssignmentDto {
  @IsString() clientId!: string;
  @IsOptional() @IsString() enrollmentId?: string;
  @IsString() formId!: string;
  @IsOptional() @IsString() assignedUserId?: string | null;
  @IsOptional() @IsString() completionMethod?: string;
  @IsOptional() @IsString() deliveryMethod?: string;
  @IsOptional() @IsString() recipientEmail?: string | null;
  @IsOptional() @IsString() recipientPhone?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsBoolean() isDemo?: boolean;
  @IsOptional() @IsString() sentAt?: string;
}

export class UpdateCfFormAssignmentDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() responses?: Record<string, string>;
  @IsOptional() editHistory?: unknown[];
  @IsOptional() @IsString() sentAt?: string;
  @IsOptional() @IsString() openedAt?: string;
  @IsOptional() @IsString() startedAt?: string;
  @IsOptional() @IsString() submittedAt?: string;
  @IsOptional() @IsString() cancelledAt?: string;
}

export class SendCfFormAssignmentDto {
  @IsOptional() @IsString() personalMessage?: string;
}
