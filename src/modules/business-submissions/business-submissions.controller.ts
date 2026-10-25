import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CreateBusinessSubmissionDto } from './dto/create-business-submission.dto';
import { BusinessSubmissionsService } from './business-submissions.service';
import { FilesService, MAX_IMAGE_UPLOAD_BYTES } from '../files/files.service';

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

  // Used by the public signup form (FBAPP BusinessForm.tsx) before the submission exists,
  // so it is unauthenticated like createSubmission; uploadImage restricts folder and file type.
  @Post('programs/:programSlug/files/upload')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES, files: 1 } }))
  uploadForSubmission(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('subdirectory') subdirectory?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided.');
    return this.filesService.uploadImage({
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
