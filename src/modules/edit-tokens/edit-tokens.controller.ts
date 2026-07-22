import { BadRequestException, Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { SubmitEditTokenDto } from './dto/submit-edit-token.dto';
import { SubmitEditSessionDto } from './dto/submit-edit-session.dto';
import { EditTokensService } from './edit-tokens.service';
import { FilesService } from '../files/files.service';

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

  @Post('businesses/edit-session/upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadWithToken(
    @Query('token') token: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Body('subdirectory') subdirectory?: string,
  ) {
    if (!token) throw new BadRequestException('Token is required.');
    if (!file) throw new BadRequestException('No file provided.');
    await this.editTokensService.validateAndGetBusiness(token);
    return this.filesService.uploadFile({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
      subdirectory,
    });
  }
}
