import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CfEnrollmentStatus, Prisma } from '../../generated/clientflow';
import { createHash, randomBytes } from 'crypto';
import { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import { PublicFormResponseValue, SubmitPublicFormDto } from './dto/submit-public-form.dto';
import {
  ensureCoreIntakeFields,
  INTAKE_FIELD_KEYS,
  normalizePublicFormFields,
  PublicFormFieldShape,
  TOP_LEVEL_FIELD_KEYS,
} from './form-field-mapping';

interface ClientIntake {
  businessDescription?: string;
  assistanceRequested?: string;
  businessType?: string;
  programOfInterest?: string;
  budgetNeed?: string;
  preferredContact?: string;
  heardAboutUs?: string;
  additionalComments?: string;
}

export interface RenderedSection {
  id: string;
  kind: 'core' | 'program';
  templateId: string;
  templateVersion: number;
  programId: string | null;
  title: string;
  description: string;
  fields: PublicFormFieldShape[];
}

const SOCIAL_HOSTS: Record<string, string[]> = {
  facebookUrl: ['facebook.com', 'fb.com'],
  instagramUrl: ['instagram.com'],
  linkedinUrl: ['linkedin.com'],
  tiktokUrl: ['tiktok.com'],
  youtubeUrl: ['youtube.com', 'youtu.be'],
};

function mapResponsesToClient(
  fields: PublicFormFieldShape[],
  responses: Record<string, PublicFormResponseValue>,
  currentIntake: ClientIntake,
): { client: Record<string, string>; intake: ClientIntake; socialLinks?: string[] } {
  const client: Record<string, string> = {};
  const intake = { ...currentIntake };

  for (const field of fields) {
    const response = responses[field.id];
    const value = typeof response === 'string' ? response.trim() : '';
    if (!value) continue;

    const mappingKey = field.prefillKey ?? field.id;
    if (field.id === 'contact' && /preferred/i.test(field.label)) {
      intake.preferredContact = value;
      continue;
    }

    const topLevelKey = TOP_LEVEL_FIELD_KEYS[mappingKey];
    if (topLevelKey) {
      client[topLevelKey] = value;
      continue;
    }

    const intakeKey = INTAKE_FIELD_KEYS[mappingKey] as keyof ClientIntake | undefined;
    if (intakeKey) intake[intakeKey] = value;
  }

  const hasSocialFields = fields.some((field) => field.id in SOCIAL_HOSTS);
  const socialLinks = hasSocialFields
    ? Object.keys(SOCIAL_HOSTS)
        .map((fieldId) => {
          const response = responses[fieldId];
          return typeof response === 'string' ? response.trim() : '';
        })
        .filter((value): value is string => Boolean(value))
    : undefined;

  return { client, intake, socialLinks };
}

function isBlankResponse(value: PublicFormResponseValue | undefined): boolean {
  return value === undefined
    || value === null
    || (typeof value === 'string' && value.trim().length === 0)
    || (Array.isArray(value) && value.length === 0);
}

function resolveDesiredStartDate(
  fields: PublicFormFieldShape[],
  responses: Record<string, PublicFormResponseValue>,
): Date | null {
  const startField = fields.find((field) => field.id === 'start');
  const value = startField ? responses[startField.id] : undefined;
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

function hashSubmission(dto: SubmitPublicFormDto): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize({
      configurationToken: dto.configurationToken,
      coreResponses: dto.coreResponses,
      programResponses: dto.programResponses,
      selectedProgramIds: [...new Set(dto.selectedProgramIds)].sort(),
    })))
    .digest('hex');
}

function resolvePrefill(
  fields: PublicFormFieldShape[],
  client: {
    email: string;
    phone: string;
    businessName: string;
    primaryContactName: string;
    website?: string | null;
    socialLinks?: Prisma.JsonValue;
    intake: ClientIntake;
  },
): Record<string, string> {
  const result: Record<string, string> = {};
  const intake = client.intake ?? {};

  const byKey: Record<string, string> = {
    email: client.email,
    phone: client.phone,
    businessName: client.businessName,
    primaryContactName: client.primaryContactName,
    website: client.website ?? '',
    businessDescription: intake.businessDescription ?? '',
    programOfInterest: intake.programOfInterest ?? '',
    assistanceRequested: intake.assistanceRequested ?? '',
    businessType: intake.businessType ?? '',
    budgetNeed: intake.budgetNeed ?? '',
    preferredContact: intake.preferredContact ?? '',
    heardAboutUs: intake.heardAboutUs ?? '',
  };

  const byFieldId: Record<string, string> = {
    email: client.email,
    phone: client.phone,
    business: client.businessName,
    bizName: client.businessName,
    brandName: client.businessName,
    contact: client.primaryContactName,
    fullName: client.primaryContactName,
    name: client.primaryContactName,
    applicant: client.primaryContactName,
    website: client.website ?? '',
    description: intake.businessDescription ?? '',
    assistance: intake.assistanceRequested ?? '',
    bizType: intake.businessType ?? '',
    industry: intake.businessType ?? '',
    program: intake.programOfInterest ?? '',
    budget: intake.budgetNeed ?? '',
  };

  const socialLinks = Array.isArray(client.socialLinks)
    ? client.socialLinks.filter((link): link is string => typeof link === 'string')
    : [];

  for (const field of fields) {
    let value = '';
    const socialHosts = SOCIAL_HOSTS[field.id];
    if (socialHosts) {
      value = socialLinks.find((link) =>
        socialHosts.some((host) => link.toLowerCase().includes(host)),
      ) ?? '';
    } else if (field.prefillKey && byKey[field.prefillKey]) {
      value = byKey[field.prefillKey];
    } else if (byFieldId[field.id]) {
      value = byFieldId[field.id];
    }
    if (value) result[field.id] = value;
  }

  return result;
}

@Injectable()
export class PublicFormService {
  constructor(private readonly prisma: ClientflowPrismaService) {}

  async getPublicForm(token: string) {
    const assignment = await this.prisma.cfFormAssignment.findUnique({
      where: { secureLinkToken: token },
    });
    if (!assignment) throw new NotFoundException('Form link not found.');

    const [template, client, program, programs, sectionTemplates] = await Promise.all([
      this.prisma.cfFormTemplate.findFirst({
        where: { id: assignment.formId, organizationId: assignment.organizationId },
      }),
      this.prisma.cfClient.findFirst({
        where: { id: assignment.clientId, organizationId: assignment.organizationId },
      }),
      this.prisma.cfProgram.findFirst({
        where: { organizationId: assignment.organizationId, defaultFormTemplateId: assignment.formId },
      }),
      this.prisma.cfProgram.findMany({
        where: { organizationId: assignment.organizationId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.cfFormTemplate.findMany({
        where: {
          organizationId: assignment.organizationId,
          scope: 'program_section',
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    if (!template) throw new NotFoundException('Form configuration not found.');

    // client may be null when the sender was created via the frontend quick-create
    // flow and not yet synced to the DB. Fall back gracefully instead of 404.
    const contactName =
      client?.primaryContactName ??
      assignment.recipientEmail ??
      'Client';

    // Auto-mark as opened if it was sent/delivered
    if (assignment.status === 'sent' || assignment.status === 'delivered') {
      await this.prisma.cfFormAssignment.update({
        where: { id: assignment.id },
        data: { status: 'opened', openedAt: new Date() },
      });
    }

    const fields = ensureCoreIntakeFields(template.fields);
    const activeProgramIds = new Set(programs.map(({ id }) => id));
    const renderedSections: RenderedSection[] = [
      {
        id: `core:${template.id}:${template.version}`,
        kind: 'core',
        templateId: template.id,
        templateVersion: template.version,
        programId: null,
        title: template.name,
        description: template.description,
        fields,
      },
      ...programs.map((activeProgram): RenderedSection => {
        const section = sectionTemplates.find(
          (candidate) => candidate.programId === activeProgram.id && activeProgramIds.has(activeProgram.id),
        );
        return {
          id: section
            ? `program:${activeProgram.id}:${section.id}:${section.version}`
            : `program:${activeProgram.id}:empty`,
          kind: 'program',
          templateId: section?.id ?? '',
          templateVersion: section?.version ?? 0,
          programId: activeProgram.id,
          title: section?.name ?? activeProgram.name,
          description: section?.description ?? '',
          fields: section ? normalizePublicFormFields(section.fields) : [],
        };
      }),
    ];
    const configurationToken = randomBytes(32).toString('hex');
    await this.prisma.cfIntakeRenderSession.create({
      data: {
        organizationId: assignment.organizationId,
        formAssignmentId: assignment.id,
        configurationToken,
        coreTemplateId: template.id,
        coreTemplateVersion: template.version,
        renderedSections: renderedSections as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    const prefill = client
      ? resolvePrefill(fields, {
          email: client.email,
          phone: client.phone,
          businessName: client.businessName,
          primaryContactName: client.primaryContactName,
          website: client.website,
          socialLinks: client.socialLinks,
          intake: (client.intake ?? {}) as ClientIntake,
        })
      : {};

    return {
      assignment: {
        id: assignment.id,
        status: assignment.status,
        dueDate: assignment.dueDate ?? null,
      },
      form: {
        id: template.id,
        name: template.name,
        description: template.description,
        fields: fields.map(({ id, label, type, required, options, prefillKey }) => {
          const resolvedOptions =
            id === 'program' || prefillKey === 'programOfInterest'
              ? programs.map(({ name }) => name)
              : options;
          return {
            id,
            label,
            type,
            required,
            ...(resolvedOptions?.length ? { options: resolvedOptions } : {}),
          };
        }),
      },
      program: {
        name: program?.name ?? 'EA Management Program',
      },
      intakeConfiguration: {
        configurationToken,
        programs,
        sections: renderedSections,
      },
      contact: {
        name: contactName,
      },
      prefill,
    };
  }

  async submitPublicForm(token: string, dto: SubmitPublicFormDto) {
    const assignment = await this.prisma.cfFormAssignment.findUnique({
      where: { secureLinkToken: token },
    });
    if (!assignment) throw new NotFoundException('Form link not found.');

    const requestHash = hashSubmission(dto);
    const replay = await this.findSubmissionReplay(
      assignment.organizationId,
      assignment.id,
      dto.idempotencyKey,
      requestHash,
    );
    if (replay) return replay;

    if (['submitted', 'approved', 'cancelled', 'expired'].includes(assignment.status)) {
      throw new BadRequestException(`This form has already been ${assignment.status}.`);
    }

    const [existingClient, renderSession] = await Promise.all([
      this.prisma.cfClient.findFirst({
        where: { id: assignment.clientId, organizationId: assignment.organizationId },
      }),
      this.prisma.cfIntakeRenderSession.findFirst({
        where: {
          configurationToken: dto.configurationToken,
          formAssignmentId: assignment.id,
          organizationId: assignment.organizationId,
          expiresAt: { gt: new Date() },
        },
      }),
    ]);
    if (!existingClient) throw new NotFoundException('Client record not found.');
    if (!renderSession) throw new BadRequestException('Form configuration has expired. Reload the form.');

    const renderedSections = renderSession.renderedSections as unknown as RenderedSection[];
    const coreSection = renderedSections.find((section) => section.kind === 'core');
    if (!coreSection) throw new BadRequestException('Core intake configuration is missing.');

    const selectedProgramIds = [...new Set(dto.selectedProgramIds)];
    if (selectedProgramIds.length === 0) {
      throw new BadRequestException('Select at least one program.');
    }
    const selectedProgramSet = new Set(selectedProgramIds);
    const selectedSections = renderedSections.filter(
      (section) => section.kind === 'core'
        || (section.programId !== null && selectedProgramSet.has(section.programId)),
    );
    const availableProgramIds = new Set(
      renderedSections
        .filter((section) => section.kind === 'program')
        .map((section) => section.programId),
    );
    const invalidProgramIds = selectedProgramIds.filter((id) => !availableProgramIds.has(id));
    if (invalidProgramIds.length > 0) {
      throw new BadRequestException('One or more selected programs are unavailable.');
    }
    const programs = await this.prisma.cfProgram.findMany({
      where: {
        organizationId: assignment.organizationId,
        id: { in: selectedProgramIds },
        isActive: true,
      },
      select: { id: true },
    });
    if (programs.length !== selectedProgramIds.length) {
      throw new BadRequestException('One or more selected programs are inactive.');
    }

    const submittedProgramIds = Object.keys(dto.programResponses);
    if (submittedProgramIds.some((programId) => !selectedProgramSet.has(programId))) {
      throw new BadRequestException('Answers were submitted for an unselected program.');
    }
    if (selectedProgramIds.some((programId) =>
      !Object.prototype.hasOwnProperty.call(dto.programResponses, programId),
    )) {
      throw new BadRequestException('Every selected program requires its own answer section.');
    }

    const coreFieldIds = new Set(coreSection.fields.map((field) => field.id));
    if (Object.keys(dto.coreResponses).some((fieldId) => !coreFieldIds.has(fieldId))) {
      throw new BadRequestException('One or more core answers do not belong to this form.');
    }

    const missingFields = coreSection.fields.filter(
      (field) => field.required && isBlankResponse(dto.coreResponses[field.id]),
    );
    for (const programId of selectedProgramIds) {
      const section = selectedSections.find((candidate) => candidate.programId === programId);
      const responses = dto.programResponses[programId] ?? {};
      const fieldIds = new Set(section?.fields.map((field) => field.id) ?? []);
      if (Object.keys(responses).some((fieldId) => !fieldIds.has(fieldId))) {
        throw new BadRequestException('One or more program answers do not belong to the selected program.');
      }
      missingFields.push(...(section?.fields ?? []).filter(
        (field) => field.required && isBlankResponse(responses[field.id]),
      ));
    }
    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Please complete: ${missingFields.map((field) => field.label).join(', ')}.`,
      );
    }

    const mapped = mapResponsesToClient(
      coreSection.fields,
      dto.coreResponses,
      (existingClient.intake ?? {}) as ClientIntake,
    );
    const desiredStartDate = resolveDesiredStartDate(coreSection.fields, dto.coreResponses);
    const now = new Date();
    const execute = async () => this.prisma.$transaction(async (tx) => {
      const existing = await tx.cfIntakeSubmission.findFirst({
        where: {
          organizationId: assignment.organizationId,
          OR: [
            { formAssignmentId: assignment.id },
            { idempotencyKey: dto.idempotencyKey },
          ],
        },
      });
      if (existing) {
        return this.resolveReplay(existing, assignment.id, dto.idempotencyKey, requestHash);
      }

      const existingEnrollments = await tx.cfProgramEnrollment.findMany({
        where: {
          organizationId: assignment.organizationId,
          clientId: assignment.clientId,
          programId: { in: selectedProgramIds },
        },
        select: { id: true, programId: true, startDate: true },
      });
      const enrollmentByProgram = new Map(
        existingEnrollments.map((enrollment) => [enrollment.programId, enrollment]),
      );
      for (const programId of selectedProgramIds) {
        const existingEnrollment = enrollmentByProgram.get(programId);
        if (existingEnrollment) {
          if (desiredStartDate && !existingEnrollment.startDate) {
            await tx.cfProgramEnrollment.update({
              where: { id: existingEnrollment.id },
              data: { startDate: desiredStartDate },
            });
          }
          continue;
        }
        const enrollment = await tx.cfProgramEnrollment.create({
          data: {
            organizationId: assignment.organizationId,
            clientId: assignment.clientId,
            programId,
            status: CfEnrollmentStatus.interested,
            assignedUserId: existingClient.assignedUserId,
            assignedStaff: existingClient.assignedStaff,
            startDate: desiredStartDate,
            isDemo: existingClient.isDemo,
          },
        });
        enrollmentByProgram.set(programId, enrollment);
        await tx.cfEnrollmentStatusHistory.create({
          data: {
            organizationId: assignment.organizationId,
            enrollmentId: enrollment.id,
            newStatus: CfEnrollmentStatus.interested,
            reason: 'Created from master intake submission.',
          },
        });
      }

      const result = {
        success: true,
        enrollmentIds: selectedProgramIds.map((programId) => enrollmentByProgram.get(programId)!.id),
      };
      const submission = await tx.cfIntakeSubmission.create({
        data: {
          organizationId: assignment.organizationId,
          clientId: assignment.clientId,
          formAssignmentId: assignment.id,
          idempotencyKey: dto.idempotencyKey,
          requestHash,
          configurationToken: dto.configurationToken,
          responsePayload: dto.coreResponses as Prisma.InputJsonValue,
          resultPayload: result,
          source: assignment.deliveryMethod ?? 'secure_link',
          submitterEmail: assignment.recipientEmail,
          isDemo: assignment.isDemo,
          submittedAt: now,
        },
      });
      await tx.cfIntakeSubmissionSnapshot.create({
        data: {
          organizationId: assignment.organizationId,
          intakeSubmissionId: submission.id,
          coreTemplateId: renderSession.coreTemplateId,
          coreTemplateVersion: renderSession.coreTemplateVersion,
          selectedProgramIds,
          renderedSections: selectedSections as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.cfIntakeSubmissionProgram.createMany({
        data: selectedProgramIds.map((programId) => ({
          organizationId: assignment.organizationId,
          intakeSubmissionId: submission.id,
          programId,
          enrollmentId: enrollmentByProgram.get(programId)!.id,
          responsePayload: (dto.programResponses[programId] ?? {}) as Prisma.InputJsonValue,
        })),
      });
      await tx.cfFormAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'submitted',
          responses: dto.coreResponses as Prisma.InputJsonValue,
          submittedAt: now,
          ...(dto.startedAt && !assignment.startedAt
            ? { startedAt: new Date(dto.startedAt) }
            : {}),
        },
      });
      await tx.cfClient.update({
        where: { id: assignment.clientId },
        data: {
          ...mapped.client,
          ...(mapped.socialLinks?.length ? { socialLinks: mapped.socialLinks } : {}),
          intake: mapped.intake as Prisma.InputJsonValue,
        },
      });
      await tx.cfActivityLog.create({
        data: {
          organizationId: assignment.organizationId,
          clientId: assignment.clientId,
          action: 'Master intake submitted',
          description: `Intake submitted for ${selectedProgramIds.length} program(s).`,
          user: 'client',
          timestamp: now,
        },
      });
      return result;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await execute();
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError
          && (error.code === 'P2002' || error.code === 'P2034');
        if (!retryable) throw error;
        const committed = await this.findSubmissionReplay(
          assignment.organizationId,
          assignment.id,
          dto.idempotencyKey,
          requestHash,
        );
        if (committed) return committed;
        if (attempt === 1) throw error;
      }
    }

    throw new BadRequestException('Unable to submit the form.');
  }

  private async findSubmissionReplay(
    organizationId: string,
    formAssignmentId: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const submission = await this.prisma.cfIntakeSubmission.findFirst({
      where: {
        organizationId,
        OR: [{ formAssignmentId }, { idempotencyKey }],
      },
    });
    return submission
      ? this.resolveReplay(submission, formAssignmentId, idempotencyKey, requestHash)
      : null;
  }

  private resolveReplay(
    submission: {
      formAssignmentId: string;
      idempotencyKey: string;
      requestHash: string;
      resultPayload: Prisma.JsonValue;
    },
    formAssignmentId: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
    if (submission.formAssignmentId !== formAssignmentId) {
      throw new BadRequestException('This idempotency key belongs to a different form assignment.');
    }
    if (submission.idempotencyKey === idempotencyKey && submission.requestHash !== requestHash) {
      throw new BadRequestException('This idempotency key was already used with different answers.');
    }
    return submission.resultPayload;
  }
}
