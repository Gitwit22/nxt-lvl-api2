import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CreateBusinessSubmissionDto } from './dto/create-business-submission.dto';
import { BusinessSubmissionsService } from './business-submissions.service';

@Controller()
export class BusinessSubmissionsController {
  constructor(private readonly submissionsService: BusinessSubmissionsService) {}

  @Post('programs/:programSlug/business-submissions')
  createSubmission(
    @Param('programSlug') programSlug: string,
    @Body() dto: CreateBusinessSubmissionDto,
  ) {
    return this.submissionsService.createSubmission(programSlug, dto);
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
