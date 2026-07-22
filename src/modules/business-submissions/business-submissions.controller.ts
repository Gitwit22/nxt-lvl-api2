import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CreateBusinessSubmissionDto } from './dto/create-business-submission.dto';
import { BusinessSubmissionsService } from './business-submissions.service';
import { FilesService } from '../files/files.service';

@Controller()
export class BusinessSubmissionsController {
  constructor(
    private readonly submissionsService: BusinessSubmissionsService,
    private readonly filesService: FilesService,
  ) {}

  @Post('programs/:programSlug/business-submissions')
  createSubmission(
    @Param('programSlug') programSlug: string,
    @Body() dto: CreateBusinessSubmissionDto,
  ) {
    return this.submissionsService.createSubmission(programSlug, dto);
  }

  @Post('programs/:programSlug/files/upload')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadForSubmission(
    @UploadedFile() file: Express.Multer.File,
    @Body('subdirectory') subdirectory?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided.');
    return this.filesService.uploadFile({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype,
      subdirectory,
    });
  }

  @UseGuards(AdminJwtGuard)
  @Get('admin/submissions')
  getPendingSubmissions() {
    return this.submissionsService.listPending();
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/submissions/:id/approve')
  approve(@Param('id') id: string, @Headers('x-admin-id') adminId: string) {
    return this.submissionsService.approveSubmission(id, adminId);
  }

  @UseGuards(AdminJwtGuard)
  @Patch('admin/submissions/:id/reject')
  reject(@Param('id') id: string, @Headers('x-admin-id') adminId: string) {
    return this.submissionsService.rejectSubmission(id, adminId);
  }
}
