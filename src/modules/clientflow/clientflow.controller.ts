import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Header, Logger,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { OrgAdminGuard } from '../../common/guards/org-admin.guard';
import { ClientflowService } from './clientflow.service';
import { CreateCfClientDto } from './dto/create-cf-client.dto';
import { UpdateCfClientDto } from './dto/update-cf-client.dto';
import { CreateCfProgramDto, UpdateCfProgramDto } from './dto/cf-program.dto';
import {
  CreateCfFormAssignmentDto,
  SendCfFormAssignmentDto,
  UpdateCfFormAssignmentDto,
} from './dto/cf-form-assignment.dto';
import { CreateCfFormTemplateDto, UpdateCfFormTemplateDto } from './dto/cf-form-template.dto';
import { TransitionToLiveModeDto } from './dto/transition-to-live-mode.dto';
import { CreateCfTermsDto, UpdateCfTermsDto } from './dto/cf-terms.dto';
import {
  CreateCfEnrollmentMonitoringDto,
  RecordCfEnrollmentMonitoringResultDto,
} from './dto/cf-enrollment-monitoring.dto';
import { CreateCfContractDto, UpdateCfContractDto } from './dto/cf-contract.dto';
import {
  CreateCfDocumentUploadDto,
  CreateCfCommunicationDto,
  CreateCfFinalReportDto,
  CreateCfActivityDto,
} from './dto/cf-records.dto';
import { CreateCfEnrollmentDto, UpdateCfEnrollmentDto } from './dto/cf-enrollment.dto';
import { EnrollmentService } from './enrollment.service';
import { MonitoringService } from './monitoring.service';

@Controller('admin/cf')
@UseGuards(AdminJwtGuard)
export class ClientflowController {
  private readonly logger = new Logger(ClientflowController.name);

  constructor(
    private readonly svc: ClientflowService,
    private readonly enrollments: EnrollmentService,
    private readonly monitoring: MonitoringService,
  ) {}

  // ─── Clients ────────────────────────────────────────────────────────────────

  @Get('clients')
  listClients(@Query('includeArchived') includeArchived?: string) {
    return this.svc.listClients(includeArchived === 'true');
  }

  @Get('clients/:id')
  getClient(@Param('id') id: string) { return this.svc.getClient(id); }

  @Post('clients')
  createClient(@Body() dto: CreateCfClientDto) { return this.svc.createClient(dto); }

  @Patch('clients/:id')
  updateClient(@Param('id') id: string, @Body() dto: UpdateCfClientDto) { return this.svc.updateClient(id, dto); }

  // ─── Programs ───────────────────────────────────────────────────────────────

  @Get('programs')
  listPrograms() { return this.svc.listPrograms(); }

  @Get('programs/:id/detail')
  getProgramDetail(@Param('id') id: string) { return this.svc.getProgramDetail(id); }

  @Post('programs')
  createProgram(@Body() dto: CreateCfProgramDto) { return this.svc.createProgram(dto); }

  @Patch('programs/:id')
  updateProgram(@Param('id') id: string, @Body() dto: UpdateCfProgramDto) { return this.svc.updateProgram(id, dto); }

  // ─── Program Enrollments ──────────────────────────────────────────────────

  @Get('enrollments')
  listEnrollments(
    @Query('clientId') clientId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.enrollments.list(clientId, programId);
  }

  @Get('enrollments/:id')
  getEnrollment(@Param('id') id: string) { return this.enrollments.get(id); }

  @Get('enrollments/:id/history')
  getEnrollmentHistory(@Param('id') id: string) { return this.enrollments.history(id); }

  @Post('enrollments')
  createEnrollment(@Body() dto: CreateCfEnrollmentDto) { return this.enrollments.create(dto); }

  @Patch('enrollments/:id')
  updateEnrollment(@Param('id') id: string, @Body() dto: UpdateCfEnrollmentDto) {
    return this.enrollments.update(id, dto);
  }

  // ─── Form Templates ─────────────────────────────────────────────────────────

  @Get('form-templates')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  listFormTemplates() { return this.svc.listFormTemplates(); }

  @Post('form-templates')
  createFormTemplate(@Body() dto: CreateCfFormTemplateDto) { return this.svc.createFormTemplate(dto); }

  @Patch('form-templates/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  updateFormTemplate(@Param('id') id: string, @Body() dto: UpdateCfFormTemplateDto) {
    if (id === 'form-inspired-detroit' || id === 'form-inspired-detroit-approved') {
      this.logger.log(JSON.stringify({
        diagnostic: 'form-template-save:controller',
        templateId: id,
        programId: dto.programId,
        scope: dto.scope,
        fieldCount: dto.fields?.length ?? null,
        fieldIds: dto.fields?.map((field) =>
          field && typeof field === 'object' && 'id' in field ? field.id : null),
        fields: dto.fields,
      }));
    }
    return this.svc.updateFormTemplate(id, dto);
  }

  // ─── Form Assignments ────────────────────────────────────────────────────────

  @Get('form-assignments')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  listFormAssignments(
    @Query('clientId') clientId?: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listFormAssignments(clientId, enrollmentId); }

  @Post('form-assignments')
  createFormAssignment(@Body() dto: CreateCfFormAssignmentDto) { return this.svc.createFormAssignment(dto); }

  @Post('form-assignments/:id/send')
  sendFormAssignment(@Param('id') id: string, @Body() dto: SendCfFormAssignmentDto) {
    return this.svc.sendFormAssignment(id, dto);
  }

  @Patch('form-assignments/:id')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  updateFormAssignment(@Param('id') id: string, @Body() dto: UpdateCfFormAssignmentDto) { return this.svc.updateFormAssignment(id, dto); }

  // ─── Intake Submission History ────────────────────────────────────────────

  @Get('intake-submissions')
  listIntakeSubmissions(
    @Query('clientId') clientId?: string,
    @Query('programId') programId?: string,
  ) { return this.svc.listIntakeSubmissions(clientId, programId); }

  @Get('intake-submissions/:id')
  getIntakeSubmission(@Param('id') id: string) { return this.svc.getIntakeSubmission(id); }

  // ─── Global lists (all records for org) ────────────────────────────────────

  @Get('terms')
  listAllTerms(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listAllTerms(
      limit ? Math.min(parseInt(limit), 500) : 200,
      offset ? parseInt(offset) : 0
    );
  }

  @Get('monitoring')
  listAllMonitoring(@Query('enrollmentId') enrollmentId?: string) {
    return this.monitoring.list(enrollmentId);
  }

  @Get('contracts')
  listAllContracts(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listAllContracts(
      limit ? Math.min(parseInt(limit), 500) : 200,
      offset ? parseInt(offset) : 0
    );
  }

  @Get('documents')
  listAllDocuments(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listAllDocuments(
      limit ? Math.min(parseInt(limit), 500) : 200,
      offset ? parseInt(offset) : 0
    );
  }

  @Get('communications')
  listAllCommunications(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listAllCommunications(
      limit ? Math.min(parseInt(limit), 500) : 200,
      offset ? parseInt(offset) : 0
    );
  }

  @Get('final-reports')
  listAllFinalReports(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.svc.listAllFinalReports(
      limit ? Math.min(parseInt(limit), 500) : 200,
      offset ? parseInt(offset) : 0
    );
  }

  // ─── Terms ──────────────────────────────────────────────────────────────────

  @Get('clients/:clientId/terms')
  listTerms(
    @Param('clientId') clientId: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listTerms(clientId, enrollmentId); }

  @Post('clients/:clientId/terms')
  createTerms(@Param('clientId') clientId: string, @Body() dto: CreateCfTermsDto) { return this.svc.createTerms(clientId, dto); }

  @Patch('terms/:id')
  updateTerms(@Param('id') id: string, @Body() dto: UpdateCfTermsDto) { return this.svc.updateTerms(id, dto); }

  // ─── Monitoring ─────────────────────────────────────────────────────────────

  @Post('enrollments/:enrollmentId/monitoring')
  createEnrollmentMonitoring(
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: CreateCfEnrollmentMonitoringDto,
  ) { return this.monitoring.create(enrollmentId, dto); }

  @Post('enrollment-monitoring/:id/results')
  recordMonitoringResult(
    @Param('id') id: string,
    @Body() dto: RecordCfEnrollmentMonitoringResultDto,
  ) { return this.monitoring.recordResult(id, dto); }

  @Get('enrollment-monitoring/:id/history')
  getMonitoringHistory(@Param('id') id: string) { return this.monitoring.history(id); }

  // ─── Contracts ──────────────────────────────────────────────────────────────

  @Get('clients/:clientId/contracts')
  listContracts(
    @Param('clientId') clientId: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listContracts(clientId, enrollmentId); }

  @Post('clients/:clientId/contracts')
  createContract(@Param('clientId') clientId: string, @Body() dto: CreateCfContractDto) { return this.svc.createContract(clientId, dto); }

  @Patch('contracts/:id')
  updateContract(@Param('id') id: string, @Body() dto: UpdateCfContractDto) { return this.svc.updateContract(id, dto); }

  // ─── Documents ──────────────────────────────────────────────────────────────

  @Get('clients/:clientId/documents')
  listDocuments(
    @Param('clientId') clientId: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listDocuments(clientId, enrollmentId); }

  @Post('clients/:clientId/documents/upload-intent')
  createDocumentUpload(
    @Param('clientId') clientId: string,
    @Body() dto: CreateCfDocumentUploadDto,
  ) { return this.svc.createDocumentUpload(clientId, dto); }

  @Post('documents/:id/complete-upload')
  completeDocumentUpload(@Param('id') id: string) { return this.svc.completeDocumentUpload(id); }

  @Get('documents/:id/download')
  getDocumentDownload(@Param('id') id: string) { return this.svc.getDocumentDownload(id); }

  // ─── Communications ─────────────────────────────────────────────────────────

  @Get('clients/:clientId/communications')
  listCommunications(
    @Param('clientId') clientId: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listCommunications(clientId, enrollmentId); }

  @Post('clients/:clientId/communications')
  createCommunication(@Param('clientId') clientId: string, @Body() dto: CreateCfCommunicationDto) { return this.svc.createCommunication(clientId, dto); }

  // ─── Final Reports ──────────────────────────────────────────────────────────

  @Get('clients/:clientId/final-reports')
  listFinalReports(
    @Param('clientId') clientId: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listFinalReports(clientId, enrollmentId); }

  @Post('clients/:clientId/final-reports')
  createFinalReport(@Param('clientId') clientId: string, @Body() dto: CreateCfFinalReportDto) { return this.svc.createFinalReport(clientId, dto); }

  // ─── Activity ────────────────────────────────────────────────────────────────

  @Get('activity')
  listActivity(
    @Query('clientId') clientId?: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listActivity(clientId, enrollmentId); }

  @Get('clients/:clientId/activity')
  listClientActivity(
    @Param('clientId') clientId: string,
    @Query('enrollmentId') enrollmentId?: string,
  ) { return this.svc.listActivity(clientId, enrollmentId); }

  @Post('activity')
  createActivity(@Body() dto: CreateCfActivityDto) { return this.svc.createActivity(dto); }

  // ─── Demo Data ───────────────────────────────────────────────────────────────

  @Get('demo-status')
  getDemoStatus() { return this.svc.getDemoStatus(); }

  @Post('seed-demo')
  @UseGuards(OrgAdminGuard)
  seedDemo() { return this.svc.seedDemo(); }

  @Post('remove-demo')
  @UseGuards(OrgAdminGuard)
  removeDemo(@Body() dto: TransitionToLiveModeDto) { return this.svc.removeDemo(dto); }
}
