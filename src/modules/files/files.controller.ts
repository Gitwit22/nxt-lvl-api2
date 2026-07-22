import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { FilesService } from './files.service';
import type { CreateFileAssetInput } from './files.service';

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

class CreateFileAssetDto implements CreateFileAssetInput {
  @IsOptional()
  @IsString()
  programId?: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsString()
  fileName!: string;

  @IsString()
  contentType!: string;

  @IsNumber()
  sizeBytes!: number;

  @IsString()
  objectKey!: string;

  @IsOptional()
  @IsString()
  publicUrl?: string;
}

@Controller('files')
@UseGuards(AdminJwtGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('subdirectory') subdirectory?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided.');
    return this.filesService.uploadFile({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
      subdirectory,
    });
  }

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

  // ─── File metadata CRUD ───────────────────────────────────────────────

  @Post('metadata')
  createMetadata(
    @Headers('x-admin-id') adminId: string,
    @Body() dto: CreateFileAssetDto,
  ) {
    return this.filesService.createFileAsset(adminId, dto);
  }

  @Get('metadata')
  listMetadata(@Headers('x-admin-id') adminId: string) {
    return this.filesService.listFileAssets(adminId);
  }

  @Delete('metadata/:id')
  deleteMetadata(
    @Param('id') id: string,
    @Headers('x-admin-id') adminId: string,
  ) {
    return this.filesService.deleteFileAsset(id, adminId);
  }
}