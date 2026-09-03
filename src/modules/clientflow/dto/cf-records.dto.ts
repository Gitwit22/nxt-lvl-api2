import { IsInt, IsString, IsOptional, Max, Min } from 'class-validator';

export class CreateCfDocumentUploadDto {
  @IsOptional() @IsString() enrollmentId?: string;
  @IsString() name!: string;
  @IsString() type!: string;
  @IsInt() @Min(1) @Max(25 * 1024 * 1024) byteSize!: number;
}

export class CreateCfCommunicationDto {
  @IsOptional() @IsString() enrollmentId?: string;
  @IsString() type!: string;
  @IsString() direction!: string;
  @IsString() subject!: string;
  @IsOptional() @IsString() notes?: string;
  @IsString() date!: string;
  @IsString() staffMember!: string;
}

export class CreateCfFinalReportDto {
  @IsOptional() @IsString() enrollmentId?: string;
  @IsString() programId!: string;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsString() originalNeed?: string;
  @IsOptional() @IsString() supportProvided?: string;
  @IsOptional() @IsString() fundingProvided?: string;
  @IsOptional() @IsString() milestonesCompleted?: string;
  @IsOptional() @IsString() resultsAchieved?: string;
  @IsOptional() @IsString() issuesEncountered?: string;
  @IsOptional() @IsString() staffComments?: string;
  @IsOptional() @IsString() clientOutcome?: string;
  @IsOptional() @IsString() recommendedNextSteps?: string;
  @IsOptional() @IsString() archiveDecision?: string;
}

export class CreateCfActivityDto {
  @IsString() clientId!: string;
  @IsOptional() @IsString() enrollmentId?: string;
  @IsString() action!: string;
  @IsString() description!: string;
}
