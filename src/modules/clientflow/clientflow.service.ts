import { Inject, Injectable, NotFoundException, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCfClientDto } from './dto/create-cf-client.dto';
import { UpdateCfClientDto } from './dto/update-cf-client.dto';
import { CreateCfProgramDto, UpdateCfProgramDto } from './dto/cf-program.dto';
import { CreateCfFormAssignmentDto, UpdateCfFormAssignmentDto } from './dto/cf-form-assignment.dto';
import { CreateCfTermsDto, UpdateCfTermsDto } from './dto/cf-terms.dto';
import { CreateCfMonitoringDto, UpdateCfMonitoringDto } from './dto/cf-monitoring.dto';
import { CreateCfContractDto, UpdateCfContractDto } from './dto/cf-contract.dto';
import { CreateCfDocumentDto, CreateCfCommunicationDto, CreateCfFinalReportDto, CreateCfActivityDto } from './dto/cf-records.dto';
import { CreateCfFormTemplateDto, UpdateCfFormTemplateDto } from './dto/cf-form-template.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable({ scope: Scope.REQUEST })
export class ClientflowService {
  private _orgId: string | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async getOrgId(): Promise<string> {
    if (this._orgId) return this._orgId;

    // Prefer org ID from JWT (stamped by AdminJwtGuard as x-org-id)
    const fromToken = this.request.headers['x-org-id'] as string | undefined;
    if (fromToken) {
      this._orgId = fromToken;
      return fromToken;
    }

    // Fallback: look up from admin user
    const adminId = this.request.headers['x-admin-id'] as string | undefined;
    if (!adminId) throw new NotFoundException('Admin context missing.');

    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found.');

    this._orgId = admin.organizationId;
    return admin.organizationId;
  }

  private async verifyClientBelongsToOrg(clientId: string, orgId: string): Promise<void> {
    const client = await this.prisma.cfClient.findFirst({ where: { id: clientId, organizationId: orgId } });
    if (!client) throw new NotFoundException('Client not found.');
  }

  // ─── Clients ────────────────────────────────────────────────────────────────

  async listClients(includeArchived = false) {
    const orgId = await this.getOrgId();
    return this.prisma.cfClient.findMany({
      where: { organizationId: orgId, ...(includeArchived ? {} : { isArchived: false }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClient(id: string) {
    const orgId = await this.getOrgId();
    const client = await this.prisma.cfClient.findFirst({ where: { id, organizationId: orgId } });
    if (!client) throw new NotFoundException('Client not found.');
    return client;
  }

  async createClient(dto: CreateCfClientDto) {
    const orgId = await this.getOrgId();
    return this.prisma.cfClient.create({
      data: {
        organizationId: orgId,
        businessName: dto.businessName,
        primaryContactName: dto.primaryContactName,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        programId: dto.programId ?? null,
        status: dto.status ?? 'New Intake',
        profileType: dto.profileType,
        relationshipType: dto.relationshipType,
        lifecycleStatus: dto.lifecycleStatus,
        assignedStaff: dto.assignedStaff,
        assignedUserId: dto.assignedUserId ?? null,
        intakeSource: dto.intakeSource ?? 'admin_created',
        source: dto.source,
        nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : null,
        convertedAt: dto.convertedAt ? new Date(dto.convertedAt) : null,
        isDemo: dto.isDemo ?? false,
        intake: dto.intake as Prisma.InputJsonValue,
        snapchat: dto.snapchat ? (dto.snapchat as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  async updateClient(id: string, dto: UpdateCfClientDto) {
    const orgId = await this.getOrgId();
    const existing = await this.prisma.cfClient.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Client not found.');

    return this.prisma.cfClient.update({
      where: { id },
      data: {
        ...(dto.businessName !== undefined && { businessName: dto.businessName }),
        ...(dto.primaryContactName !== undefined && { primaryContactName: dto.primaryContactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...('programId' in dto && { programId: dto.programId ?? null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.profileType !== undefined && { profileType: dto.profileType }),
        ...(dto.relationshipType !== undefined && { relationshipType: dto.relationshipType }),
        ...(dto.lifecycleStatus !== undefined && { lifecycleStatus: dto.lifecycleStatus }),
        ...(dto.assignedStaff !== undefined && { assignedStaff: dto.assignedStaff }),
        ...('assignedUserId' in dto && { assignedUserId: dto.assignedUserId ?? null }),
        ...(dto.intakeSource !== undefined && { intakeSource: dto.intakeSource }),
        ...(dto.nextFollowUpDate !== undefined && {
          nextFollowUpDate: dto.nextFollowUpDate ? new Date(dto.nextFollowUpDate) : null,
        }),
        ...('convertedAt' in dto && {
          convertedAt: dto.convertedAt ? new Date(dto.convertedAt) : null,
        }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
        ...(dto.archiveReason !== undefined && { archiveReason: dto.archiveReason }),
        ...(dto.finalStatus !== undefined && { finalStatus: dto.finalStatus }),
        ...(dto.archivedAt !== undefined && {
          archivedAt: dto.archivedAt ? new Date(dto.archivedAt) : null,
        }),
        ...(dto.intake !== undefined && { intake: dto.intake as Prisma.InputJsonValue }),
        ...('snapchat' in dto && {
          snapchat: dto.snapchat ? (dto.snapchat as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
      },
    });
  }

  // ─── Programs ───────────────────────────────────────────────────────────────

  async listPrograms() {
    const orgId = await this.getOrgId();
    return this.prisma.cfProgram.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' } });
  }

  async createProgram(dto: CreateCfProgramDto) {
    const orgId = await this.getOrgId();
    return this.prisma.cfProgram.create({
      data: {
        ...(dto.id && { id: dto.id }),
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
        defaultFormTemplateId: dto.defaultFormTemplateId,
        defaultMonitoringFrequency: dto.defaultMonitoringFrequency,
        defaultContractTemplateId: dto.defaultContractTemplateId,
        defaultWorkflow: (dto.defaultWorkflow ?? []) as Prisma.InputJsonValue,
        requiredDocuments: (dto.requiredDocuments ?? []) as Prisma.InputJsonValue,
        statusPipeline: (dto.statusPipeline ?? []) as Prisma.InputJsonValue,
      },
    });
  }

  async updateProgram(id: string, dto: UpdateCfProgramDto) {
    const orgId = await this.getOrgId();
    const existing = await this.prisma.cfProgram.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Program not found.');
    return this.prisma.cfProgram.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.defaultFormTemplateId !== undefined && { defaultFormTemplateId: dto.defaultFormTemplateId }),
        ...(dto.defaultMonitoringFrequency !== undefined && { defaultMonitoringFrequency: dto.defaultMonitoringFrequency }),
        ...(dto.defaultContractTemplateId !== undefined && { defaultContractTemplateId: dto.defaultContractTemplateId }),
        ...(dto.defaultWorkflow !== undefined && { defaultWorkflow: dto.defaultWorkflow as Prisma.InputJsonValue }),
        ...(dto.requiredDocuments !== undefined && { requiredDocuments: dto.requiredDocuments as Prisma.InputJsonValue }),
        ...(dto.statusPipeline !== undefined && { statusPipeline: dto.statusPipeline as Prisma.InputJsonValue }),
      },
    });
  }

  // ─── Form Templates ─────────────────────────────────────────────────────────

  async listFormTemplates() {
    const orgId = await this.getOrgId();
    return this.prisma.cfFormTemplate.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' } });
  }

  async createFormTemplate(dto: CreateCfFormTemplateDto) {
    const orgId = await this.getOrgId();
    return this.prisma.cfFormTemplate.create({
      data: {
        ...(dto.id && { id: dto.id }),
        organizationId: orgId,
        programId: dto.programId,
        name: dto.name,
        description: dto.description ?? '',
        fields: (dto.fields ?? []) as Prisma.InputJsonValue,
        emailTemplate: dto.emailTemplate ?? 'default',
        internalNotes: dto.internalNotes ?? null,
        dueInDays: dto.dueInDays ?? 7,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateFormTemplate(id: string, dto: UpdateCfFormTemplateDto) {
    const orgId = await this.getOrgId();
    const existing = await this.prisma.cfFormTemplate.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Form template not found.');
    return this.prisma.cfFormTemplate.update({
      where: { id },
      data: {
        ...(dto.programId !== undefined && { programId: dto.programId }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.fields !== undefined && { fields: dto.fields as Prisma.InputJsonValue }),
        ...(dto.emailTemplate !== undefined && { emailTemplate: dto.emailTemplate }),
        ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
        ...(dto.dueInDays !== undefined && { dueInDays: dto.dueInDays }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ─── Form Assignments ────────────────────────────────────────────────────────

  async listFormAssignments(clientId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfFormAssignment.findMany({
      where: { organizationId: orgId, ...(clientId ? { clientId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFormAssignment(dto: CreateCfFormAssignmentDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(dto.clientId, orgId);
    const form = await this.prisma.cfFormTemplate.findFirst({
      where: { id: dto.formId, organizationId: orgId },
    });
    if (!form) throw new NotFoundException('Form template not found.');

    const token = randomBytes(32).toString('hex');
    const secureLink = `${this.request.partition.appUrl}/s/${token}`;
    return this.prisma.cfFormAssignment.create({
      data: {
        organizationId: orgId,
        clientId: dto.clientId,
        formId: dto.formId,
        assignedUserId: dto.assignedUserId ?? null,
        completionMethod: dto.completionMethod,
        deliveryMethod: dto.deliveryMethod,
        recipientEmail: dto.recipientEmail ?? null,
        recipientPhone: dto.recipientPhone ?? null,
        status: 'draft',
        dueDate: dto.dueDate,
        secureLink,
        secureLinkToken: token,
        createdByUserId: dto.createdByUserId,
        isDemo: dto.isDemo ?? false,
        sentAt: null,
      },
    });
  }

  async sendFormAssignment(id: string, dto: { personalMessage?: string }) {
    const orgId = await this.getOrgId();
    const assignment = await this.prisma.cfFormAssignment.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!assignment) throw new NotFoundException('Form assignment not found.');
    if (!assignment.secureLink) throw new NotFoundException('Secure form link not found.');

    const [client, form] = await Promise.all([
      this.prisma.cfClient.findFirst({ where: { id: assignment.clientId, organizationId: orgId } }),
      this.prisma.cfFormTemplate.findFirst({ where: { id: assignment.formId, organizationId: orgId } }),
    ]);
    if (!client) throw new NotFoundException('Client not found.');
    if (!form) throw new NotFoundException('Form template not found.');

    const program = await this.prisma.cfProgram.findFirst({
      where: { id: form.programId, organizationId: orgId },
    });
    await this.notifications.sendFormLink({
      to: assignment.recipientEmail ?? client.email,
      contactName: client.primaryContactName,
      formName: form.name,
      programName: program?.name ?? 'EA Management Program',
      dueDate: assignment.dueDate
        ? new Date(assignment.dueDate).toLocaleDateString('en-US')
        : 'As soon as possible',
      secureLink: assignment.secureLink,
      personalMessage: dto.personalMessage,
    });

    return this.prisma.cfFormAssignment.update({
      where: { id: assignment.id },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  async updateFormAssignment(id: string, dto: UpdateCfFormAssignmentDto) {
    const orgId = await this.getOrgId();
    const existing = await this.prisma.cfFormAssignment.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Form assignment not found.');
    return this.prisma.cfFormAssignment.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.responses !== undefined && { responses: dto.responses as Prisma.InputJsonValue }),
        ...(dto.editHistory !== undefined && { editHistory: dto.editHistory as Prisma.InputJsonValue }),
        ...(dto.sentAt !== undefined && { sentAt: dto.sentAt ? new Date(dto.sentAt) : null }),
        ...(dto.openedAt !== undefined && { openedAt: dto.openedAt ? new Date(dto.openedAt) : null }),
        ...(dto.startedAt !== undefined && { startedAt: dto.startedAt ? new Date(dto.startedAt) : null }),
        ...(dto.submittedAt !== undefined && { submittedAt: dto.submittedAt ? new Date(dto.submittedAt) : null }),
        ...(dto.cancelledAt !== undefined && { cancelledAt: dto.cancelledAt ? new Date(dto.cancelledAt) : null }),
      },
    });
  }

  // ─── Global org-wide lists ─────────────────────────────────────────────────

  async listAllTerms() {
    const orgId = await this.getOrgId();
    return this.prisma.cfTerms.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  }

  async listAllMonitoring() {
    const orgId = await this.getOrgId();
    return this.prisma.cfMonitoringItem.findMany({ where: { organizationId: orgId }, orderBy: { dueDate: 'asc' } });
  }

  async listAllContracts() {
    const orgId = await this.getOrgId();
    return this.prisma.cfContract.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  }

  async listAllDocuments() {
    const orgId = await this.getOrgId();
    return this.prisma.cfDocument.findMany({ where: { organizationId: orgId }, orderBy: { uploadedAt: 'desc' } });
  }

  async listAllCommunications() {
    const orgId = await this.getOrgId();
    return this.prisma.cfCommunication.findMany({ where: { organizationId: orgId }, orderBy: { date: 'desc' } });
  }

  async listAllFinalReports() {
    const orgId = await this.getOrgId();
    return this.prisma.cfFinalReport.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  }

  // ─── Terms ──────────────────────────────────────────────────────────────────

  async listTerms(clientId: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfTerms.findMany({ where: { clientId, organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  }

  async createTerms(clientId: string, dto: CreateCfTermsDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    return this.prisma.cfTerms.create({
      data: {
        organizationId: orgId,
        clientId,
        programId: dto.programId,
        supportType: dto.supportType,
        fundingAmount: dto.fundingAmount ?? 0,
        resourceDescription: dto.resourceDescription ?? '',
        grantAmount: dto.grantAmount ?? 0,
        loanAmount: dto.loanAmount ?? 0,
        investmentAmount: dto.investmentAmount ?? 0,
        forgivableAmount: dto.forgivableAmount ?? 0,
        repaymentRequired: dto.repaymentRequired ?? false,
        repaymentSchedule: dto.repaymentSchedule ?? '',
        interestDescription: dto.interestDescription ?? '',
        milestones: dto.milestones ?? '',
        reportingRequirements: dto.reportingRequirements ?? '',
        startDate: dto.startDate,
        endDate: dto.endDate,
        monitoringFrequency: dto.monitoringFrequency ?? 'Monthly',
        specialConditions: dto.specialConditions ?? '',
        approvalStatus: dto.approvalStatus ?? 'Pending',
      },
    });
  }

  async updateTerms(id: string, dto: UpdateCfTermsDto) {
    const orgId = await this.getOrgId();
    const existing = await this.prisma.cfTerms.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Terms not found.');
    return this.prisma.cfTerms.update({ where: { id }, data: dto });
  }

  // ─── Monitoring ─────────────────────────────────────────────────────────────

  async listMonitoring(clientId: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfMonitoringItem.findMany({
      where: { clientId, organizationId: orgId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createMonitoringItem(clientId: string, dto: CreateCfMonitoringDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    return this.prisma.cfMonitoringItem.create({
      data: {
        organizationId: orgId,
        clientId,
        programId: dto.programId,
        type: dto.type,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? 'Scheduled',
        assignedStaff: dto.assignedStaff,
        notes: dto.notes ?? '',
      },
    });
  }

  async updateMonitoringItem(id: string, dto: UpdateCfMonitoringDto) {
    const orgId = await this.getOrgId();
    const existing = await this.prisma.cfMonitoringItem.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Monitoring item not found.');
    return this.prisma.cfMonitoringItem.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.completedAt !== undefined && { completedAt: dto.completedAt ? new Date(dto.completedAt) : null }),
      },
    });
  }

  // ─── Contracts ──────────────────────────────────────────────────────────────

  async listContracts(clientId: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfContract.findMany({ where: { clientId, organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  }

  async createContract(clientId: string, dto: CreateCfContractDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    return this.prisma.cfContract.create({
      data: {
        organizationId: orgId,
        clientId,
        programId: dto.programId,
        termsId: dto.termsId,
        contractType: dto.contractType,
        status: dto.status ?? 'Draft',
        content: dto.content,
      },
    });
  }

  async updateContract(id: string, dto: UpdateCfContractDto) {
    const orgId = await this.getOrgId();
    const existing = await this.prisma.cfContract.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) throw new NotFoundException('Contract not found.');
    return this.prisma.cfContract.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.sentAt !== undefined && { sentAt: dto.sentAt ? new Date(dto.sentAt) : null }),
        ...(dto.signedAt !== undefined && { signedAt: dto.signedAt ? new Date(dto.signedAt) : null }),
      },
    });
  }

  // ─── Documents ──────────────────────────────────────────────────────────────

  async listDocuments(clientId: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfDocument.findMany({ where: { clientId, organizationId: orgId }, orderBy: { uploadedAt: 'desc' } });
  }

  async createDocument(clientId: string, dto: CreateCfDocumentDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    return this.prisma.cfDocument.create({
      data: {
        organizationId: orgId,
        clientId,
        name: dto.name,
        type: dto.type,
        url: dto.url,
        uploadedBy: dto.uploadedBy,
        uploadedAt: dto.uploadedAt ? new Date(dto.uploadedAt) : new Date(),
      },
    });
  }

  // ─── Communications ─────────────────────────────────────────────────────────

  async listCommunications(clientId: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfCommunication.findMany({ where: { clientId, organizationId: orgId }, orderBy: { date: 'desc' } });
  }

  async createCommunication(clientId: string, dto: CreateCfCommunicationDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    return this.prisma.cfCommunication.create({
      data: {
        organizationId: orgId,
        clientId,
        type: dto.type,
        direction: dto.direction,
        subject: dto.subject,
        notes: dto.notes ?? '',
        date: new Date(dto.date),
        staffMember: dto.staffMember,
      },
    });
  }

  // ─── Final Reports ──────────────────────────────────────────────────────────

  async listFinalReports(clientId: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfFinalReport.findMany({ where: { clientId, organizationId: orgId }, orderBy: { createdAt: 'desc' } });
  }

  async createFinalReport(clientId: string, dto: CreateCfFinalReportDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    return this.prisma.cfFinalReport.create({
      data: {
        organizationId: orgId,
        clientId,
        programId: dto.programId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        originalNeed: dto.originalNeed ?? '',
        supportProvided: dto.supportProvided ?? '',
        fundingProvided: dto.fundingProvided ?? '',
        milestonesCompleted: dto.milestonesCompleted ?? '',
        resultsAchieved: dto.resultsAchieved ?? '',
        issuesEncountered: dto.issuesEncountered ?? '',
        staffComments: dto.staffComments ?? '',
        clientOutcome: dto.clientOutcome ?? '',
        recommendedNextSteps: dto.recommendedNextSteps ?? '',
        archiveDecision: dto.archiveDecision ?? '',
      },
    });
  }

  // ─── Activity Logs ──────────────────────────────────────────────────────────

  async listActivity(clientId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfActivityLog.findMany({
      where: { organizationId: orgId, ...(clientId ? { clientId } : {}) },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }

  async createActivity(dto: CreateCfActivityDto) {
    const orgId = await this.getOrgId();
    return this.prisma.cfActivityLog.create({
      data: {
        organizationId: orgId,
        clientId: dto.clientId,
        action: dto.action,
        description: dto.description,
        user: dto.user,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
    });
  }

  // ─── Demo Seed ──────────────────────────────────────────────────────────────

  async seedDemo(payload: {
    clients?: unknown[];
    programs?: unknown[];
    formTemplates?: unknown[];
    formAssignments?: unknown[];
    terms?: unknown[];
    monitoring?: unknown[];
    contracts?: unknown[];
    documents?: unknown[];
    communications?: unknown[];
    finalReports?: unknown[];
    activity?: unknown[];
  }) {
    const orgId = await this.getOrgId();

    const results: Record<string, number> = {};
    const errors: Array<{ id: string; entity: string; error: string }> = [];
    const logError = (entity: string, id: unknown) => (err: unknown): null => {
      errors.push({ id: String(id), entity, error: err instanceof Error ? err.message : String(err) });
      return null;
    };

    if (payload.programs?.length) {
      await Promise.all(
        (payload.programs as Record<string, unknown>[]).map((p) =>
          this.prisma.cfProgram.upsert({
            where: { id: p['id'] as string },
            create: { ...(p as any), organizationId: orgId } as any,
            update: {},
          }).catch(logError('program', p['id'])),
        ),
      );
      results.programs = payload.programs.length;
    }

    if (payload.formTemplates?.length) {
      await Promise.all(
        (payload.formTemplates as Record<string, unknown>[]).map((t) =>
          this.prisma.cfFormTemplate.upsert({
            where: { id: t['id'] as string },
            create: { ...(t as any), organizationId: orgId, fields: (t['fields'] ?? []) as Prisma.InputJsonValue, emailTemplate: (t['emailTemplate'] as string) ?? '' } as any,
            update: { fields: (t['fields'] ?? []) as Prisma.InputJsonValue },
          }).catch(logError('formTemplate', t['id'])),
        ),
      );
      results.formTemplates = payload.formTemplates.length;
    }

    if (payload.clients?.length) {
      await Promise.all(
        (payload.clients as Record<string, unknown>[]).map((c) =>
          this.prisma.cfClient.upsert({
            where: { id: c['id'] as string },
            create: { ...(c as any), organizationId: orgId, intake: (c['intake'] ?? {}) as Prisma.InputJsonValue, snapchat: c['snapchat'] ? (c['snapchat'] as Prisma.InputJsonValue) : Prisma.JsonNull, socialLinks: (c['socialLinks'] ?? []) as Prisma.InputJsonValue, nextFollowUpDate: c['nextFollowUpDate'] ? new Date(c['nextFollowUpDate'] as string) : null, convertedAt: c['convertedAt'] ? new Date(c['convertedAt'] as string) : null, archivedAt: c['archivedAt'] ? new Date(c['archivedAt'] as string) : null } as any,
            update: {},
          }).catch(logError('client', c['id'])),
        ),
      );
      results.clients = payload.clients.length;
    }

    if (payload.formAssignments?.length) {
      await Promise.all(
        (payload.formAssignments as Record<string, unknown>[]).map((a) =>
          this.prisma.cfFormAssignment.upsert({
            where: { id: a['id'] as string },
            create: { ...(a as any), organizationId: orgId, responses: a['responses'] ? (a['responses'] as Prisma.InputJsonValue) : Prisma.JsonNull, editHistory: a['editHistory'] ? (a['editHistory'] as Prisma.InputJsonValue) : Prisma.JsonNull, sentAt: a['sentAt'] ? new Date(a['sentAt'] as string) : null, openedAt: a['openedAt'] ? new Date(a['openedAt'] as string) : null, submittedAt: a['submittedAt'] ? new Date(a['submittedAt'] as string) : null, cancelledAt: a['cancelledAt'] ? new Date(a['cancelledAt'] as string) : null, startedAt: a['startedAt'] ? new Date(a['startedAt'] as string) : null, dueAt: a['dueAt'] ? new Date(a['dueAt'] as string) : null } as any,
            update: {},
          }).catch(logError('formAssignment', a['id'])),
        ),
      );
      results.formAssignments = payload.formAssignments.length;
    }

    if (payload.terms?.length) {
      await Promise.all(
        (payload.terms as Record<string, unknown>[]).map((t) =>
          this.prisma.cfTerms.upsert({
            where: { id: t['id'] as string },
            create: { ...(t as any), organizationId: orgId } as any,
            update: {},
          }).catch(logError('terms', t['id'])),
        ),
      );
      results.terms = payload.terms.length;
    }

    if (payload.monitoring?.length) {
      await Promise.all(
        (payload.monitoring as Record<string, unknown>[]).map((m) =>
          this.prisma.cfMonitoringItem.upsert({
            where: { id: m['id'] as string },
            create: { ...(m as any), organizationId: orgId, dueDate: new Date(m['dueDate'] as string), completedAt: m['completedAt'] ? new Date(m['completedAt'] as string) : null } as any,
            update: {},
          }).catch(logError('monitoring', m['id'])),
        ),
      );
      results.monitoring = payload.monitoring.length;
    }

    if (payload.contracts?.length) {
      await Promise.all(
        (payload.contracts as Record<string, unknown>[]).map((c) =>
          this.prisma.cfContract.upsert({
            where: { id: c['id'] as string },
            create: { ...(c as any), organizationId: orgId, sentAt: c['sentAt'] ? new Date(c['sentAt'] as string) : null, signedAt: c['signedAt'] ? new Date(c['signedAt'] as string) : null } as any,
            update: {},
          }).catch(logError('contract', c['id'])),
        ),
      );
      results.contracts = payload.contracts.length;
    }

    if (payload.documents?.length) {
      await Promise.all(
        (payload.documents as Record<string, unknown>[]).map((d) =>
          this.prisma.cfDocument.upsert({
            where: { id: d['id'] as string },
            create: { ...(d as any), organizationId: orgId, uploadedAt: d['uploadedAt'] ? new Date(d['uploadedAt'] as string) : new Date() } as any,
            update: {},
          }).catch(logError('document', d['id'])),
        ),
      );
      results.documents = payload.documents.length;
    }

    if (payload.communications?.length) {
      await Promise.all(
        (payload.communications as Record<string, unknown>[]).map((c) =>
          this.prisma.cfCommunication.upsert({
            where: { id: c['id'] as string },
            create: { ...(c as any), organizationId: orgId, date: new Date(c['date'] as string) } as any,
            update: {},
          }).catch(logError('communication', c['id'])),
        ),
      );
      results.communications = payload.communications.length;
    }

    if (payload.finalReports?.length) {
      await Promise.all(
        (payload.finalReports as Record<string, unknown>[]).map((f) =>
          this.prisma.cfFinalReport.upsert({
            where: { id: f['id'] as string },
            create: { ...(f as any), organizationId: orgId } as any,
            update: {},
          }).catch(logError('finalReport', f['id'])),
        ),
      );
      results.finalReports = payload.finalReports.length;
    }

    if (payload.activity?.length) {
      await Promise.all(
        (payload.activity as Record<string, unknown>[]).map((a) =>
          this.prisma.cfActivityLog.upsert({
            where: { id: a['id'] as string },
            create: { ...(a as any), organizationId: orgId, timestamp: a['timestamp'] ? new Date(a['timestamp'] as string) : new Date() } as any,
            update: {},
          }).catch(logError('activity', a['id'])),
        ),
      );
      results.activity = payload.activity.length;
    }

    return { seeded: results, errors };
  }

  // ─── Demo Remove ────────────────────────────────────────────────────────────

  async removeDemo(ids: {
    clientIds?: string[];
    programIds?: string[];
    formTemplateIds?: string[];
    formAssignmentIds?: string[];
    termsIds?: string[];
    monitoringIds?: string[];
    contractIds?: string[];
    documentIds?: string[];
    communicationIds?: string[];
    finalReportIds?: string[];
    activityIds?: string[];
  }) {
    const orgId = await this.getOrgId();
    const where = (idList: string[]) => ({ id: { in: idList }, organizationId: orgId });

    await Promise.all([
      ids.clientIds?.length && this.prisma.cfClient.deleteMany({ where: where(ids.clientIds) }),
      ids.programIds?.length && this.prisma.cfProgram.deleteMany({ where: where(ids.programIds) }),
      ids.formTemplateIds?.length && this.prisma.cfFormTemplate.deleteMany({ where: where(ids.formTemplateIds) }),
      ids.formAssignmentIds?.length && this.prisma.cfFormAssignment.deleteMany({ where: where(ids.formAssignmentIds) }),
      ids.termsIds?.length && this.prisma.cfTerms.deleteMany({ where: where(ids.termsIds) }),
      ids.monitoringIds?.length && this.prisma.cfMonitoringItem.deleteMany({ where: where(ids.monitoringIds) }),
      ids.contractIds?.length && this.prisma.cfContract.deleteMany({ where: where(ids.contractIds) }),
      ids.documentIds?.length && this.prisma.cfDocument.deleteMany({ where: where(ids.documentIds) }),
      ids.communicationIds?.length && this.prisma.cfCommunication.deleteMany({ where: where(ids.communicationIds) }),
      ids.finalReportIds?.length && this.prisma.cfFinalReport.deleteMany({ where: where(ids.finalReportIds) }),
      ids.activityIds?.length && this.prisma.cfActivityLog.deleteMany({ where: where(ids.activityIds) }),
    ].filter(Boolean));

    return { removed: true };
  }
}
