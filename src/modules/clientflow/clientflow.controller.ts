import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { ClientflowService } from './clientflow.service';
import { CreateCfClientDto } from './dto/create-cf-client.dto';
import { UpdateCfClientDto } from './dto/update-cf-client.dto';
import { CreateCfProgramDto, UpdateCfProgramDto } from './dto/cf-program.dto';
import { CreateCfFormAssignmentDto, UpdateCfFormAssignmentDto } from './dto/cf-form-assignment.dto';
import { CreateCfTermsDto, UpdateCfTermsDto } from './dto/cf-terms.dto';
import { CreateCfMonitoringDto, UpdateCfMonitoringDto } from './dto/cf-monitoring.dto';
import { CreateCfContractDto, UpdateCfContractDto } from './dto/cf-contract.dto';
import {
  CreateCfDocumentDto,
  CreateCfCommunicationDto,
  CreateCfFinalReportDto,
  CreateCfActivityDto,
} from './dto/cf-records.dto';

@Controller('admin/cf')
@UseGuards(AdminJwtGuard)
export class ClientflowController {
  constructor(private readonly svc: ClientflowService) {}

  // ─── Clients ────────────────────────────────────────────────────────────────

  @Get('clients')
  listClients() { return this.svc.listClients(); }

  @Get('clients/:id')
  getClient(@Param('id') id: string) { return this.svc.getClient(id); }

  @Post('clients')
  createClient(@Body() dto: CreateCfClientDto) { return this.svc.createClient(dto); }

  @Patch('clients/:id')
  updateClient(@Param('id') id: string, @Body() dto: UpdateCfClientDto) { return this.svc.updateClient(id, dto); }

  // ─── Programs ───────────────────────────────────────────────────────────────

  @Get('programs')
  listPrograms() { return this.svc.listPrograms(); }

  @Post('programs')
  createProgram(@Body() dto: CreateCfProgramDto) { return this.svc.createProgram(dto); }

  @Patch('programs/:id')
  updateProgram(@Param('id') id: string, @Body() dto: UpdateCfProgramDto) { return this.svc.updateProgram(id, dto); }

  // ─── Form Templates ─────────────────────────────────────────────────────────

  @Get('form-templates')
  listFormTemplates() { return this.svc.listFormTemplates(); }

  // ─── Form Assignments ────────────────────────────────────────────────────────

  @Get('form-assignments')
  listFormAssignments(@Query('clientId') clientId?: string) { return this.svc.listFormAssignments(clientId); }

  @Post('form-assignments')
  createFormAssignment(@Body() dto: CreateCfFormAssignmentDto) { return this.svc.createFormAssignment(dto); }

  @Patch('form-assignments/:id')
  updateFormAssignment(@Param('id') id: string, @Body() dto: UpdateCfFormAssignmentDto) { return this.svc.updateFormAssignment(id, dto); }

  // ─── Terms ──────────────────────────────────────────────────────────────────

  @Get('clients/:clientId/terms')
  listTerms(@Param('clientId') clientId: string) { return this.svc.listTerms(clientId); }

  @Post('clients/:clientId/terms')
  createTerms(@Param('clientId') clientId: string, @Body() dto: CreateCfTermsDto) { return this.svc.createTerms(clientId, dto); }

  @Patch('terms/:id')
  updateTerms(@Param('id') id: string, @Body() dto: UpdateCfTermsDto) { return this.svc.updateTerms(id, dto); }

  // ─── Monitoring ─────────────────────────────────────────────────────────────

  @Get('clients/:clientId/monitoring')
  listMonitoring(@Param('clientId') clientId: string) { return this.svc.listMonitoring(clientId); }

  @Post('clients/:clientId/monitoring')
  createMonitoringItem(@Param('clientId') clientId: string, @Body() dto: CreateCfMonitoringDto) { return this.svc.createMonitoringItem(clientId, dto); }

  @Patch('monitoring/:id')
  updateMonitoringItem(@Param('id') id: string, @Body() dto: UpdateCfMonitoringDto) { return this.svc.updateMonitoringItem(id, dto); }

  // ─── Contracts ──────────────────────────────────────────────────────────────

  @Get('clients/:clientId/contracts')
  listContracts(@Param('clientId') clientId: string) { return this.svc.listContracts(clientId); }

  @Post('clients/:clientId/contracts')
  createContract(@Param('clientId') clientId: string, @Body() dto: CreateCfContractDto) { return this.svc.createContract(clientId, dto); }

  @Patch('contracts/:id')
  updateContract(@Param('id') id: string, @Body() dto: UpdateCfContractDto) { return this.svc.updateContract(id, dto); }

  // ─── Documents ──────────────────────────────────────────────────────────────

  @Get('clients/:clientId/documents')
  listDocuments(@Param('clientId') clientId: string) { return this.svc.listDocuments(clientId); }

  @Post('clients/:clientId/documents')
  createDocument(@Param('clientId') clientId: string, @Body() dto: CreateCfDocumentDto) { return this.svc.createDocument(clientId, dto); }

  // ─── Communications ─────────────────────────────────────────────────────────

  @Get('clients/:clientId/communications')
  listCommunications(@Param('clientId') clientId: string) { return this.svc.listCommunications(clientId); }

  @Post('clients/:clientId/communications')
  createCommunication(@Param('clientId') clientId: string, @Body() dto: CreateCfCommunicationDto) { return this.svc.createCommunication(clientId, dto); }

  // ─── Final Reports ──────────────────────────────────────────────────────────

  @Get('clients/:clientId/final-reports')
  listFinalReports(@Param('clientId') clientId: string) { return this.svc.listFinalReports(clientId); }

  @Post('clients/:clientId/final-reports')
  createFinalReport(@Param('clientId') clientId: string, @Body() dto: CreateCfFinalReportDto) { return this.svc.createFinalReport(clientId, dto); }

  // ─── Activity ────────────────────────────────────────────────────────────────

  @Get('activity')
  listActivity(@Query('clientId') clientId?: string) { return this.svc.listActivity(clientId); }

  @Get('clients/:clientId/activity')
  listClientActivity(@Param('clientId') clientId: string) { return this.svc.listActivity(clientId); }

  @Post('activity')
  createActivity(@Body() dto: CreateCfActivityDto) { return this.svc.createActivity(dto); }

  // ─── Demo Data ───────────────────────────────────────────────────────────────

  @Post('seed-demo')
  seedDemo(@Body() payload: Record<string, unknown[]>) { return this.svc.seedDemo(payload); }

  @Post('remove-demo')
  removeDemo(@Body() ids: Record<string, string[]>) { return this.svc.removeDemo(ids); }
}
