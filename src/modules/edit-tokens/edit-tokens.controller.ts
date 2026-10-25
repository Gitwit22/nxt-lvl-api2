import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { SubmitEditTokenDto } from './dto/submit-edit-token.dto';
import { SubmitEditSessionDto } from './dto/submit-edit-session.dto';
import { EditTokensService } from './edit-tokens.service';
import { FilesService, MAX_IMAGE_UPLOAD_BYTES } from '../files/files.service';

@Controller()
export class EditTokensController {
  constructor(
    private readonly editTokensService: EditTokensService,
    private readonly filesService: FilesService,
  ) {}

  @Get('edit-links/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validateToken(@Param('token') token: string) {
    return this.editTokensService.validateAndGetBusiness(token);
  }

  @Post('edit-links/:token/submit')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  submitEdit(@Param('token') token: string, @Body() dto: SubmitEditTokenDto) {
    return this.editTokensService.submit(token, dto);
  }

  @Get('businesses/edit-session')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  validateEditSession(@Query('token') token?: string) {
    if (!token) {
      throw new BadRequestException('Token is required.');
    }
    return this.editTokensService.validateAndGetBusiness(token);
  }

  @Post('businesses/edit-session')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  submitEditSession(@Body() dto: SubmitEditSessionDto) {
    return this.editTokensService.submit(dto.token, { payload: dto.updates });
  }

  // Used by the edit-link page (FBAPP src/app/edit/page.tsx) for logo/cover/photo uploads.
  @Post('businesses/edit-session/upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES, files: 1 } }))
  async uploadWithEditSession(
    @Query('token') token: string | undefined,
    @Query('subdirectory') subdirectory: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!token) throw new BadRequestException('Token is required.');
    if (!file) throw new BadRequestException('No file provided.');
    // Same check as the edit form itself: only a live, unused edit link may upload.
    await this.editTokensService.validateAndGetBusiness(token);
    return this.filesService.uploadImage({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
      subdirectory,
    });
  }
}
