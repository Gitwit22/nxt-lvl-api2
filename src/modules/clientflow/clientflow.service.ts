import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '../../generated/clientflow';
import { compare } from 'bcrypt';
import { randomBytes } from 'crypto';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCfClientDto } from './dto/create-cf-client.dto';
import { UpdateCfClientDto } from './dto/update-cf-client.dto';
import { CreateCfProgramDto, UpdateCfProgramDto } from './dto/cf-program.dto';
import { CreateCfFormAssignmentDto, UpdateCfFormAssignmentDto } from './dto/cf-form-assignment.dto';
import { CreateCfTermsDto, UpdateCfTermsDto } from './dto/cf-terms.dto';
import { CreateCfContractDto, UpdateCfContractDto } from './dto/cf-contract.dto';
import { CreateCfDocumentDto, CreateCfCommunicationDto, CreateCfFinalReportDto, CreateCfActivityDto } from './dto/cf-records.dto';
import { CreateCfFormTemplateDto, UpdateCfFormTemplateDto } from './dto/cf-form-template.dto';
import { TransitionToLiveModeDto } from './dto/transition-to-live-mode.dto';
import { NotificationsService } from '../notifications/notifications.service';
import {
  canonicalFieldKey,
  ensureCoreIntakeFields,
  MappableFormField,
  normalizeProgramFormFields,
  normalizePublicFormFields,
} from './form-field-mapping';
import type {
  CfProgramDetailAnswer,
  CfProgramDetailAnswerGroup,
  CfProgramDetailResponse,
} from './dto/cf-program-detail.dto';

type LiveOrganizationState = {
  liveMode: boolean;
  demoRemovedAt: Date | null;
  principalAdminId: string | null;
};

function validateTemplateFields(
  scope: string,
  programId: string | null,
  rawFields: unknown[],
): void {
  const fields = rawFields.filter((field): field is MappableFormField =>
    Boolean(field)
      && typeof field === 'object'
      && typeof (field as MappableFormField).id === 'string'
      && typeof (field as MappableFormField).label === 'string',
  );
  if (fields.length !== rawFields.length) {
    throw new BadRequestException('Every form field requires an ID and label.');
  }
  const blankField = fields.find((field) => !field.id.trim() || !field.label.trim());
  if (blankField) {
    throw new BadRequestException('Every form field requires a non-empty ID and label.');
  }

  const duplicateId = fields.find((field, index) =>
    fields.findIndex((candidate) => candidate.id === field.id) !== index,
  );
  if (duplicateId) throw new BadRequestException(`Duplicate form field ID: ${duplicateId.id}.`);

  const isProgramSection = scope === 'program_section' || (scope === 'legacy' && programId !== null);
  if (isProgramSection) {
    const repeated = fields.find((field) => canonicalFieldKey(field) !== null);
    if (repeated) {
      throw new BadRequestException(
        `${repeated.label} is shared intake information and belongs in the Master Intake form.`,
      );
    }
  }

  if (scope === 'master_core') {
    const seen = new Set<string>();
    for (const field of fields) {
      const canonical = canonicalFieldKey(field);
      if (!canonical) continue;
      if (seen.has(canonical)) {
        throw new BadRequestException(`The Master Intake contains more than one ${canonical} field.`);
      }
      seen.add(canonical);
    }
  }
}

type DetailField = { id: string; label: string; type?: string };
type DetailSection = {
  id: string;
  kind: 'core' | 'program';
  programId: string | null;
  title: string;
  fields: DetailField[];
};

function jsonRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function detailFields(value: unknown): DetailField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is DetailField =>
    field !== null
      && typeof field === 'object'
      && typeof (field as DetailField).id === 'string'
      && typeof (field as DetailField).label === 'string',
  );
}

function detailSections(value: unknown): DetailSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((section) => {
    if (section === null || typeof section !== 'object') return [];
    const candidate = section as Partial<DetailSection>;
    if (
      typeof candidate.id !== 'string'
      || (candidate.kind !== 'core' && candidate.kind !== 'program')
      || typeof candidate.title !== 'string'
    ) return [];
    return [{
      id: candidate.id,
      kind: candidate.kind,
      programId: typeof candidate.programId === 'string' ? candidate.programId : null,
      title: candidate.title,
      fields: detailFields(candidate.fields),
    }];
  });
}

function labeledAnswers(fields: DetailField[], responses: unknown): CfProgramDetailAnswer[] {
  const values = jsonRecord(responses);
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  return Object.entries(values).map(([fieldId, value]) => ({
    fieldId,
    label: fieldsById.get(fieldId)?.label ?? fieldId,
    ...(fieldsById.get(fieldId)?.type ? { type: fieldsById.get(fieldId)!.type } : {}),
    value,
  }));
}

@Injectable({ scope: Scope.REQUEST })
export class ClientflowService {
  private _orgId: string | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: ClientflowPrismaService,
    private readonly primaryPrisma: PrismaService,
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

    const admin = await this.primaryPrisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found.');

    this._orgId = admin.organizationId;
    return admin.organizationId;
  }

  private async verifyClientBelongsToOrg(clientId: string, orgId: string): Promise<void> {
    const client = await this.prisma.cfClient.findFirst({ where: { id: clientId, organizationId: orgId } });
    if (!client) throw new NotFoundException('Client not found.');
  }

  private async verifyEnrollmentScope(
    enrollmentId: string | undefined,
    clientId: string,
    programId: string,
    orgId: string,
  ): Promise<void> {
    if (!enrollmentId) return;
    const enrollment = await this.verifyEnrollmentBelongsToClient(enrollmentId, clientId, orgId);
    if (enrollment.programId !== programId) {
      throw new BadRequestException('Enrollment does not match this client and program.');
    }
  }

  private async verifyEnrollmentBelongsToClient(
    enrollmentId: string,
    clientId: string,
    orgId: string,
  ) {
    const enrollment = await this.prisma.cfProgramEnrollment.findFirst({
      where: { id: enrollmentId, clientId, organizationId: orgId },
      select: { id: true, programId: true },
    });
    if (!enrollment) {
      throw new BadRequestException('Enrollment does not match this client.');
    }
    return enrollment;
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

  async getProgramDetail(programId: string): Promise<CfProgramDetailResponse> {
    const orgId = await this.getOrgId();
    const program = await this.prisma.cfProgram.findFirst({
      where: { id: programId, organizationId: orgId },
    });
    if (!program) throw new NotFoundException('Program not found.');

    const enrollments = await this.prisma.cfProgramEnrollment.findMany({
      where: { organizationId: orgId, programId, isArchived: false },
      orderBy: { createdAt: 'desc' },
    });
    const enrollmentIds = enrollments.map(({ id }) => id);
    const clientIds = [...new Set(enrollments.map(({ clientId }) => clientId))];

    const [clients, intakeLinks, assignments, terms, contracts, monitoring] = await Promise.all([
      this.prisma.cfClient.findMany({
        where: { organizationId: orgId, id: { in: clientIds } },
        select: {
          id: true,
          businessName: true,
          primaryContactName: true,
          email: true,
          phone: true,
        },
      }),
      this.prisma.cfIntakeSubmissionProgram.findMany({
        where: { organizationId: orgId, programId, enrollmentId: { in: enrollmentIds } },
      }),
      this.prisma.cfFormAssignment.findMany({
        where: {
          organizationId: orgId,
          OR: [
            { enrollmentId: { in: enrollmentIds } },
            { enrollmentId: null, clientId: { in: clientIds } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cfTerms.findMany({
        where: {
          organizationId: orgId,
          programId,
          OR: [
            { enrollmentId: { in: enrollmentIds } },
            { enrollmentId: null, clientId: { in: clientIds } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cfContract.findMany({
        where: {
          organizationId: orgId,
          programId,
          OR: [
            { enrollmentId: { in: enrollmentIds } },
            { enrollmentId: null, clientId: { in: clientIds } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cfEnrollmentMonitoring.findMany({
        where: {
          organizationId: orgId,
          enrollmentId: { in: enrollmentIds },
        },
        orderBy: { nextReviewAt: 'asc' },
      }),
    ]);

    const submissionIds = [...new Set(intakeLinks.map(({ intakeSubmissionId }) => intakeSubmissionId))];
    const formIds = [...new Set(assignments.map(({ formId }) => formId))];
    const [submissions, snapshots, templates] = await Promise.all([
      this.prisma.cfIntakeSubmission.findMany({
        where: { organizationId: orgId, id: { in: submissionIds } },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.cfIntakeSubmissionSnapshot.findMany({
        where: { organizationId: orgId, intakeSubmissionId: { in: submissionIds } },
      }),
      this.prisma.cfFormTemplate.findMany({
        where: { organizationId: orgId, id: { in: formIds } },
      }),
    ]);

    const clientById = new Map(clients.map((client) => [client.id, client]));
    const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
    const snapshotBySubmissionId = new Map(
      snapshots.map((snapshot) => [snapshot.intakeSubmissionId, snapshot]),
    );
    const templateById = new Map(templates.map((template) => [template.id, template]));

    const participants = enrollments.flatMap((enrollment) => {
      const client = clientById.get(enrollment.clientId);
      if (!client) return [];
      const enrollmentLinks = intakeLinks.filter((link) => link.enrollmentId === enrollment.id);
      const coreIntake: CfProgramDetailAnswerGroup[] = [];
      const programIntake: CfProgramDetailAnswerGroup[] = [];

      for (const link of enrollmentLinks) {
        const submission = submissionById.get(link.intakeSubmissionId);
        if (!submission) continue;
        const sections = detailSections(
          snapshotBySubmissionId.get(submission.id)?.renderedSections,
        );
        for (const section of sections.filter(({ kind }) => kind === 'core')) {
          coreIntake.push({
            id: `${submission.id}:${section.id}`,
            title: section.title,
            submittedAt: submission.submittedAt,
            answers: labeledAnswers(section.fields, submission.responsePayload),
          });
        }
        for (const section of sections.filter(
          ({ kind, programId: sectionProgramId }) =>
            kind === 'program' && sectionProgramId === programId,
        )) {
          programIntake.push({
            id: `${submission.id}:${section.id}`,
            title: section.title,
            submittedAt: submission.submittedAt,
            answers: labeledAnswers(section.fields, link.responsePayload),
          });
        }
      }

      const participantForms = assignments
        .filter((assignment) => {
          if (assignment.enrollmentId) return assignment.enrollmentId === enrollment.id;
          const template = templateById.get(assignment.formId);
          return assignment.clientId === enrollment.clientId && template?.programId === programId;
        })
        .map((assignment) => {
          const template = templateById.get(assignment.formId);
          return {
            id: assignment.id,
            formId: assignment.formId,
            templateName: template?.name ?? 'Form',
            status: assignment.status,
            dueAt: assignment.dueAt,
            dueDate: assignment.dueDate,
            sentAt: assignment.sentAt,
            openedAt: assignment.openedAt,
            submittedAt: assignment.submittedAt,
            answers: labeledAnswers(detailFields(template?.fields), assignment.responses),
          };
        });
      const matchesEnrollment = (record: { enrollmentId: string | null; clientId: string }) =>
        record.enrollmentId
          ? record.enrollmentId === enrollment.id
          : record.clientId === enrollment.clientId;

      return [{
        client,
        enrollment,
        coreIntake,
        programIntake,
        forms: participantForms,
        terms: terms.filter(matchesEnrollment),
        contracts: contracts.filter(matchesEnrollment),
        monitoring: monitoring.filter((record) => record.enrollmentId === enrollment.id),
      }];
    });

    const closedStatuses = new Set(['declined', 'withdrawn']);
    return {
      program,
      summary: {
        current: enrollments.filter(({ status }) =>
          status !== 'completed' && !closedStatuses.has(status),
        ).length,
        completed: enrollments.filter(({ status }) => status === 'completed').length,
        closed: enrollments.filter(({ status }) => closedStatuses.has(status)).length,
      },
      participants,
    };
  }

  // ─── Form Templates ─────────────────────────────────────────────────────────

  async listFormTemplates() {
    const orgId = await this.getOrgId();
    const templates = await this.prisma.cfFormTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });
    return templates.map((template) => ({
      ...template,
      fields: template.scope === 'master_core'
        ? ensureCoreIntakeFields(template.fields)
        : template.scope === 'program_section' || template.programId !== null
          ? normalizeProgramFormFields(template.fields, template.programId, template.id)
          : normalizePublicFormFields(template.fields),
    }));
  }

  async createFormTemplate(dto: CreateCfFormTemplateDto) {
    const orgId = await this.getOrgId();
    validateTemplateFields(dto.scope ?? 'legacy', dto.programId ?? null, dto.fields ?? []);
    return this.prisma.cfFormTemplate.create({
      data: {
        ...(dto.id && { id: dto.id }),
        organizationId: orgId,
        programId: dto.programId ?? null,
        scope: dto.scope ?? 'legacy',
        version: dto.version ?? 1,
        sortOrder: dto.sortOrder ?? 0,
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
    validateTemplateFields(
      dto.scope ?? existing.scope,
      dto.programId !== undefined ? dto.programId : existing.programId,
      dto.fields ?? (Array.isArray(existing.fields) ? existing.fields : []),
    );
    return this.prisma.cfFormTemplate.update({
      where: { id },
      data: {
        ...(dto.programId !== undefined && { programId: dto.programId }),
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.version !== undefined && { version: dto.version }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
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

  async listFormAssignments(clientId?: string, enrollmentId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfFormAssignment.findMany({
      where: {
        organizationId: orgId,
        ...(clientId ? { clientId } : {}),
        ...(enrollmentId ? { enrollmentId } : {}),
      },
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
    if (dto.enrollmentId) {
      if (!form.programId) {
        throw new BadRequestException('The Master Intake cannot be assigned to one enrollment.');
      }
      await this.verifyEnrollmentScope(dto.enrollmentId, dto.clientId, form.programId, orgId);
    }

    const token = randomBytes(32).toString('hex');
    const secureLink = `${this.request.partition.appUrl}/s/${token}`;
    return this.prisma.cfFormAssignment.create({
      data: {
        organizationId: orgId,
        clientId: dto.clientId,
        enrollmentId: dto.enrollmentId,
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

    const program = form.programId
      ? await this.prisma.cfProgram.findFirst({
          where: { id: form.programId, organizationId: orgId },
        })
      : null;
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

  // ─── Intake Submission History ─────────────────────────────────────────────

  async listIntakeSubmissions(clientId?: string, programId?: string) {
    const orgId = await this.getOrgId();
    const programLinks = programId
      ? await this.prisma.cfIntakeSubmissionProgram.findMany({
          where: { organizationId: orgId, programId },
          select: { intakeSubmissionId: true },
        })
      : [];
    const submissionIds = programLinks.map(({ intakeSubmissionId }) => intakeSubmissionId);
    if (programId && submissionIds.length === 0) return [];

    const submissions = await this.prisma.cfIntakeSubmission.findMany({
      where: {
        organizationId: orgId,
        ...(clientId ? { clientId } : {}),
        ...(programId ? { id: { in: submissionIds } } : {}),
      },
      orderBy: { submittedAt: 'desc' },
    });
    const ids = submissions.map(({ id }) => id);
    const clientIds = [...new Set(submissions.map(({ clientId: id }) => id))];
    const [clients, links, snapshots] = await Promise.all([
      this.prisma.cfClient.findMany({
        where: { organizationId: orgId, id: { in: clientIds } },
        select: { id: true, businessName: true, primaryContactName: true, email: true },
      }),
      this.prisma.cfIntakeSubmissionProgram.findMany({
        where: { organizationId: orgId, intakeSubmissionId: { in: ids } },
      }),
      this.prisma.cfIntakeSubmissionSnapshot.findMany({
        where: { organizationId: orgId, intakeSubmissionId: { in: ids } },
      }),
    ]);
    const clientById = new Map(clients.map((client) => [client.id, client]));
    return submissions.map((submission) => ({
      ...submission,
      client: clientById.get(submission.clientId) ?? null,
      programs: links.filter((link) => link.intakeSubmissionId === submission.id),
      snapshot: snapshots.find((snapshot) => snapshot.intakeSubmissionId === submission.id) ?? null,
    }));
  }

  async getIntakeSubmission(id: string) {
    const orgId = await this.getOrgId();
    const submission = await this.prisma.cfIntakeSubmission.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!submission) throw new NotFoundException('Intake submission not found.');

    const [client, assignment, snapshot, programs] = await Promise.all([
      this.prisma.cfClient.findFirst({
        where: { id: submission.clientId, organizationId: orgId },
      }),
      this.prisma.cfFormAssignment.findFirst({
        where: { id: submission.formAssignmentId, organizationId: orgId },
      }),
      this.prisma.cfIntakeSubmissionSnapshot.findFirst({
        where: { intakeSubmissionId: id, organizationId: orgId },
      }),
      this.prisma.cfIntakeSubmissionProgram.findMany({
        where: { intakeSubmissionId: id, organizationId: orgId },
      }),
    ]);
    return { ...submission, client, assignment, snapshot, programs };
  }

  // ─── Global org-wide lists ─────────────────────────────────────────────────

  async listAllTerms() {
    const orgId = await this.getOrgId();
    return this.prisma.cfTerms.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
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

  async listTerms(clientId: string, enrollmentId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfTerms.findMany({
      where: { clientId, organizationId: orgId, ...(enrollmentId && { enrollmentId }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTerms(clientId: string, dto: CreateCfTermsDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    await this.verifyEnrollmentScope(dto.enrollmentId, clientId, dto.programId, orgId);
    return this.prisma.cfTerms.create({
      data: {
        organizationId: orgId,
        clientId,
        enrollmentId: dto.enrollmentId,
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

  // ─── Contracts ──────────────────────────────────────────────────────────────

  async listContracts(clientId: string, enrollmentId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfContract.findMany({
      where: { clientId, organizationId: orgId, ...(enrollmentId && { enrollmentId }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createContract(clientId: string, dto: CreateCfContractDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    await this.verifyEnrollmentScope(dto.enrollmentId, clientId, dto.programId, orgId);
    return this.prisma.cfContract.create({
      data: {
        organizationId: orgId,
        clientId,
        enrollmentId: dto.enrollmentId,
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

  async listDocuments(clientId: string, enrollmentId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfDocument.findMany({
      where: { clientId, organizationId: orgId, ...(enrollmentId && { enrollmentId }) },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async createDocument(clientId: string, dto: CreateCfDocumentDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    if (dto.enrollmentId) {
      await this.verifyEnrollmentBelongsToClient(dto.enrollmentId, clientId, orgId);
    }
    return this.prisma.cfDocument.create({
      data: {
        organizationId: orgId,
        clientId,
        enrollmentId: dto.enrollmentId,
        name: dto.name,
        type: dto.type,
        url: dto.url,
        uploadedBy: dto.uploadedBy,
        uploadedAt: dto.uploadedAt ? new Date(dto.uploadedAt) : new Date(),
      },
    });
  }

  // ─── Communications ─────────────────────────────────────────────────────────

  async listCommunications(clientId: string, enrollmentId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfCommunication.findMany({
      where: { clientId, organizationId: orgId, ...(enrollmentId && { enrollmentId }) },
      orderBy: { date: 'desc' },
    });
  }

  async createCommunication(clientId: string, dto: CreateCfCommunicationDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    if (dto.enrollmentId) {
      await this.verifyEnrollmentBelongsToClient(dto.enrollmentId, clientId, orgId);
    }
    return this.prisma.cfCommunication.create({
      data: {
        organizationId: orgId,
        clientId,
        enrollmentId: dto.enrollmentId,
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

  async listFinalReports(clientId: string, enrollmentId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfFinalReport.findMany({
      where: { clientId, organizationId: orgId, ...(enrollmentId && { enrollmentId }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFinalReport(clientId: string, dto: CreateCfFinalReportDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(clientId, orgId);
    await this.verifyEnrollmentScope(dto.enrollmentId, clientId, dto.programId, orgId);
    return this.prisma.cfFinalReport.create({
      data: {
        organizationId: orgId,
        clientId,
        enrollmentId: dto.enrollmentId,
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

  async listActivity(clientId?: string, enrollmentId?: string) {
    const orgId = await this.getOrgId();
    return this.prisma.cfActivityLog.findMany({
      where: {
        organizationId: orgId,
        ...(clientId ? { clientId } : {}),
        ...(enrollmentId ? { enrollmentId } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });
  }

  async createActivity(dto: CreateCfActivityDto) {
    const orgId = await this.getOrgId();
    await this.verifyClientBelongsToOrg(dto.clientId, orgId);
    if (dto.enrollmentId) {
      await this.verifyEnrollmentBelongsToClient(dto.enrollmentId, dto.clientId, orgId);
    }
    return this.prisma.cfActivityLog.create({
      data: {
        organizationId: orgId,
        clientId: dto.clientId,
        enrollmentId: dto.enrollmentId,
        action: dto.action,
        description: dto.description,
        user: dto.user,
        timestamp: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
    });
  }

  // ─── Demo Seed ──────────────────────────────────────────────────────────────

  async getDemoStatus() {
    const orgId = await this.getOrgId();
    const organization = await this.primaryPrisma.organization.findUnique({
      where: { id: orgId },
      select: { liveMode: true, demoRemovedAt: true, principalAdminId: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');
    return organization;
  }

  private async deletePersistedDemoData(orgId: string) {
    return this.prisma.$transaction(async (tx) => {
      const demoWhere = { organizationId: orgId, isDemo: true };
      const [demoAssignments, demoSubmissions, demoEnrollments] = await Promise.all([
        tx.cfFormAssignment.findMany({ where: demoWhere, select: { id: true } }),
        tx.cfIntakeSubmission.findMany({ where: demoWhere, select: { id: true } }),
        tx.cfProgramEnrollment.findMany({ where: demoWhere, select: { id: true } }),
      ]);
      const demoAssignmentIds = demoAssignments.map(({ id }) => id);
      const demoSubmissionIds = demoSubmissions.map(({ id }) => id);
      const demoEnrollmentIds = demoEnrollments.map(({ id }) => id);

      const removedSubmissionPrograms = await tx.cfIntakeSubmissionProgram.deleteMany({
        where: { organizationId: orgId, intakeSubmissionId: { in: demoSubmissionIds } },
      });
      const removedSubmissionSnapshots = await tx.cfIntakeSubmissionSnapshot.deleteMany({
        where: { organizationId: orgId, intakeSubmissionId: { in: demoSubmissionIds } },
      });
      const removedRenderSessions = await tx.cfIntakeRenderSession.deleteMany({
        where: { organizationId: orgId, formAssignmentId: { in: demoAssignmentIds } },
      });
      const removedSubmissions = await tx.cfIntakeSubmission.deleteMany({ where: demoWhere });
      const removedEnrollmentHistory = await tx.cfEnrollmentStatusHistory.deleteMany({
        where: { organizationId: orgId, enrollmentId: { in: demoEnrollmentIds } },
      });
      const removedTasks = await tx.cfTask.deleteMany({ where: demoWhere });
      const removedActivity = await tx.cfActivityLog.deleteMany({ where: demoWhere });
      const removedCommunications = await tx.cfCommunication.deleteMany({ where: demoWhere });
      const removedDocuments = await tx.cfDocument.deleteMany({ where: demoWhere });
      const removedReports = await tx.cfFinalReport.deleteMany({ where: demoWhere });
      const removedContracts = await tx.cfContract.deleteMany({ where: demoWhere });
      const removedMonitoringEvidence = await tx.cfEnrollmentMonitoringEvidence.deleteMany({ where: demoWhere });
      const removedMonitoringHistory = await tx.cfEnrollmentMonitoringHistory.deleteMany({ where: demoWhere });
      const removedMonitoring = await tx.cfEnrollmentMonitoring.deleteMany({ where: demoWhere });
      const removedTerms = await tx.cfTerms.deleteMany({ where: demoWhere });
      const removedAssignments = await tx.cfFormAssignment.deleteMany({ where: demoWhere });
      const removedEnrollments = await tx.cfProgramEnrollment.deleteMany({ where: demoWhere });
      const removedClients = await tx.cfClient.deleteMany({ where: demoWhere });

      return {
        clients: removedClients.count,
        enrollments: removedEnrollments.count,
        enrollmentHistory: removedEnrollmentHistory.count,
        intakeSubmissions: removedSubmissions.count,
        intakeSubmissionSnapshots: removedSubmissionSnapshots.count,
        intakeSubmissionPrograms: removedSubmissionPrograms.count,
        intakeRenderSessions: removedRenderSessions.count,
        tasks: removedTasks.count,
        formAssignments: removedAssignments.count,
        terms: removedTerms.count,
        monitoring: removedMonitoring.count + removedMonitoringHistory.count + removedMonitoringEvidence.count,
        contracts: removedContracts.count,
        documents: removedDocuments.count,
        communications: removedCommunications.count,
        finalReports: removedReports.count,
        activity: removedActivity.count,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    });
  }

  async seedDemo(payload: {
    programs?: unknown[];
    formTemplates?: unknown[];
  }) {
    const orgId = await this.getOrgId();
    const organization = await this.primaryPrisma.organization.findUnique({
      where: { id: orgId },
    }) as unknown as LiveOrganizationState | null;
    if (!organization) throw new NotFoundException('Organization not found.');

    const removed = await this.deletePersistedDemoData(orgId);
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
            update: {
              programId: (t['programId'] as string | null | undefined) ?? null,
              scope: (t['scope'] as string | undefined) ?? 'legacy',
              version: (t['version'] as number | undefined) ?? 1,
              sortOrder: (t['sortOrder'] as number | undefined) ?? 0,
            },
          }).catch(logError('formTemplate', t['id'])),
        ),
      );
      results.formTemplates = payload.formTemplates.length;
    }

    return { seeded: results, removed, errors, liveMode: organization.liveMode };
  }

  // ─── Demo Remove ────────────────────────────────────────────────────────────

  async removeDemo(dto: TransitionToLiveModeDto) {
    const orgId = await this.getOrgId();
    const adminId = this.request.headers['x-admin-id'] as string | undefined;
    if (!adminId) throw new UnauthorizedException('Admin context missing.');
    if (dto.confirmation !== 'REMOVE DEMO DATA') {
      throw new BadRequestException('Type REMOVE DEMO DATA to confirm.');
    }

    const actor = await this.primaryPrisma.adminUser.findFirst({
      where: { id: adminId, organizationId: orgId },
    });
    if (!actor || !actor.isActive) throw new ForbiddenException('An active organization administrator is required.');
    if (actor.role !== 'org_admin' && actor.role !== 'super_admin') {
      throw new ForbiddenException('Only organization administrators can remove demo data permanently.');
    }
    if (!(await compare(dto.currentPassword, actor.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const organization = await this.primaryPrisma.organization.findUnique({
      where: { id: orgId },
    }) as unknown as LiveOrganizationState | null;
    if (!organization) throw new NotFoundException('Organization not found.');

    const removed = await this.prisma.$transaction(async (tx) => {
      const demoWhere = { organizationId: orgId, isDemo: true };
      const [demoAssignments, demoSubmissions, demoEnrollments] = await Promise.all([
        tx.cfFormAssignment.findMany({ where: demoWhere, select: { id: true } }),
        tx.cfIntakeSubmission.findMany({ where: demoWhere, select: { id: true } }),
        tx.cfProgramEnrollment.findMany({ where: demoWhere, select: { id: true } }),
      ]);
      const demoAssignmentIds = demoAssignments.map(({ id }) => id);
      const demoSubmissionIds = demoSubmissions.map(({ id }) => id);
      const demoEnrollmentIds = demoEnrollments.map(({ id }) => id);

      const removedSubmissionPrograms = await tx.cfIntakeSubmissionProgram.deleteMany({
        where: { organizationId: orgId, intakeSubmissionId: { in: demoSubmissionIds } },
      });
      const removedSubmissionSnapshots = await tx.cfIntakeSubmissionSnapshot.deleteMany({
        where: { organizationId: orgId, intakeSubmissionId: { in: demoSubmissionIds } },
      });
      const removedRenderSessions = await tx.cfIntakeRenderSession.deleteMany({
        where: { organizationId: orgId, formAssignmentId: { in: demoAssignmentIds } },
      });
      const removedSubmissions = await tx.cfIntakeSubmission.deleteMany({ where: demoWhere });
      const removedEnrollmentHistory = await tx.cfEnrollmentStatusHistory.deleteMany({
        where: { organizationId: orgId, enrollmentId: { in: demoEnrollmentIds } },
      });
      const removedTasks = await tx.cfTask.deleteMany({ where: demoWhere });
      const removedActivity = await tx.cfActivityLog.deleteMany({ where: demoWhere });
      const removedCommunications = await tx.cfCommunication.deleteMany({ where: demoWhere });
      const removedDocuments = await tx.cfDocument.deleteMany({ where: demoWhere });
      const removedReports = await tx.cfFinalReport.deleteMany({ where: demoWhere });
      const removedContracts = await tx.cfContract.deleteMany({ where: demoWhere });
      const removedMonitoringEvidence = await tx.cfEnrollmentMonitoringEvidence.deleteMany({ where: demoWhere });
      const removedMonitoringHistory = await tx.cfEnrollmentMonitoringHistory.deleteMany({ where: demoWhere });
      const removedMonitoring = await tx.cfEnrollmentMonitoring.deleteMany({ where: demoWhere });
      const removedTerms = await tx.cfTerms.deleteMany({ where: demoWhere });
      const removedAssignments = await tx.cfFormAssignment.deleteMany({ where: demoWhere });
      const removedEnrollments = await tx.cfProgramEnrollment.deleteMany({ where: demoWhere });
      const removedClients = await tx.cfClient.deleteMany({ where: demoWhere });

      return {
        clients: removedClients.count,
        enrollments: removedEnrollments.count,
        enrollmentHistory: removedEnrollmentHistory.count,
        intakeSubmissions: removedSubmissions.count,
        intakeSubmissionSnapshots: removedSubmissionSnapshots.count,
        intakeSubmissionPrograms: removedSubmissionPrograms.count,
        intakeRenderSessions: removedRenderSessions.count,
        tasks: removedTasks.count,
        formAssignments: removedAssignments.count,
        terms: removedTerms.count,
        monitoring: removedMonitoring.count + removedMonitoringHistory.count + removedMonitoringEvidence.count,
        contracts: removedContracts.count,
        documents: removedDocuments.count,
        communications: removedCommunications.count,
        finalReports: removedReports.count,
        activity: removedActivity.count,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    });

    const revokedAt = organization.demoRemovedAt ?? new Date();
    const updatedOrganization = await this.primaryPrisma.$transaction(async (tx) => {
      const current = await tx.organization.findUnique({ where: { id: orgId } });
      if (!current) throw new NotFoundException('Organization not found.');
      if (current.liveMode) return current;

      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { liveMode: true, demoRemovedAt: revokedAt, principalAdminId: adminId },
      });
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorAdminId: adminId,
          action: 'published',
          targetType: 'Organization',
          targetId: orgId,
          metadata: {
            event: 'CLIENTFLOW_LIVE_MODE_ENABLED',
            principalAdminId: adminId,
            removedDemoData: true,
          },
        },
      });
      return updated;
    });

    return {
      liveMode: true,
      demoRemovedAt: updatedOrganization.demoRemovedAt,
      principalAdminId: adminId,
      removed,
    };
  }
}
