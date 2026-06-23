import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class UploadMusicFileDto {
  @IsString()
  trackId!: string;

  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsNumber()
  @Min(1)
  fileSize!: number;

  @IsString()
  dataUrl!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(200)
  bpm?: number;

  @IsOptional()
  @IsString()
  mood?: string;
}

export interface MusicFileResponseDto {
  id: string;
  trackId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  duration: number;
  bpm: number;
  mood: string;
  createdAt: string;
  updatedAt: string;
  
  // For data retrieval, include dataUrl only when explicitly requested
  dataUrl?: string;
}
