import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FilesService } from './files.service';

class CreateFileUrlDto {
  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsOptional()
  @IsString()
  @IsIn(['upload', 'download', 'delete'])
  action?: 'upload' | 'download' | 'delete';

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  expiresInSeconds?: number;

  @IsOptional()
  @IsString()
  objectKey?: string;

  @IsOptional()
  @IsString()
  subdirectory?: string;
}

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('signed-url')
  createSignedUrl(@Body() dto: CreateFileUrlDto) {
    return this.filesService.createFileUrl({
      fileName: dto.fileName,
      contentType: dto.contentType,
      action: dto.action ?? 'upload',
      expiresInSeconds: dto.expiresInSeconds,
      objectKey: dto.objectKey,
      subdirectory: dto.subdirectory,
    });
  }

  @Get('signed-url/:fileName')
  getDownloadUrl(
    @Param('fileName') fileName: string,
    @Query('contentType') contentType = 'application/octet-stream',
    @Query('objectKey') objectKey: string,
  ) {
    return this.filesService.createFileUrl({
      fileName,
      contentType,
      action: 'download',
      objectKey,
    });
  }

  @Delete('signed-url/:fileName')
  deleteUrl(
    @Param('fileName') fileName: string,
    @Query('contentType') contentType = 'application/octet-stream',
    @Query('objectKey') objectKey: string,
  ) {
    return this.filesService.createFileUrl({
      fileName,
      contentType,
      action: 'delete',
      objectKey,
    });
  }
}