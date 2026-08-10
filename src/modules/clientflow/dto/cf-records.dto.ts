import { IsString, IsOptional } from 'class-validator';

export class CreateCfDocumentDto {
  @IsString() name!: string;
  @IsString() type!: string;
  @IsString() url!: string;
  @IsString() uploadedBy!: string;
  @IsOptional() @IsString() uploadedAt?: string;
}

export class CreateCfCommunicationDto {
  @IsString() type!: string;
  @IsString() direction!: string;
  @IsString() subject!: string;
  @IsOptional() @IsString() notes?: string;
  @IsString() date!: string;
  @IsString() staffMember!: string;
}

export class CreateCfFinalReportDto {
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
  @IsString() action!: string;
  @IsString() description!: string;
  @IsString() user!: string;
  @IsOptional() @IsString() timestamp?: string;
}
