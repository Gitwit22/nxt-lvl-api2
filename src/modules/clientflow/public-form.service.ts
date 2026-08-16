import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitPublicFormDto } from './dto/submit-public-form.dto';

interface FormFieldShape {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  prefillKey?: string;
}

interface ClientIntake {
  businessDescription?: string;
  assistanceRequested?: string;
  programOfInterest?: string;
  budgetNeed?: string;
  preferredContact?: string;
  heardAboutUs?: string;
  additionalComments?: string;
}

const TOP_LEVEL_RESPONSE_KEYS: Record<string, string> = {
  businessName: 'businessName',
  primaryContactName: 'primaryContactName',
  email: 'email',
  phone: 'phone',
  website: 'website',
  business: 'businessName',
  bizName: 'businessName',
  brandName: 'businessName',
  name: 'primaryContactName',
  fullName: 'primaryContactName',
  applicant: 'primaryContactName',
};

const INTAKE_RESPONSE_KEYS: Record<string, keyof ClientIntake> = {
  businessDescription: 'businessDescription',
  description: 'businessDescription',
  assistanceRequested: 'assistanceRequested',
  assistance: 'assistanceRequested',
  programOfInterest: 'programOfInterest',
  program: 'programOfInterest',
  budgetNeed: 'budgetNeed',
  budget: 'budgetNeed',
  preferredContact: 'preferredContact',
  contact_pref: 'preferredContact',
  heardAboutUs: 'heardAboutUs',
  heard: 'heardAboutUs',
  additionalComments: 'additionalComments',
  comments: 'additionalComments',
};

function mapResponsesToClient(
  fields: FormFieldShape[],
  responses: Record<string, string>,
  currentIntake: ClientIntake,
): { client: Record<string, string>; intake: ClientIntake } {
  const client: Record<string, string> = {};
  const intake = { ...currentIntake };

  for (const field of fields) {
    const value = responses[field.id]?.trim();
    if (!value) continue;

    const mappingKey = field.prefillKey ?? field.id;
    if (field.id === 'contact' && /preferred/i.test(field.label)) {
      intake.preferredContact = value;
      continue;
    }

    const topLevelKey = TOP_LEVEL_RESPONSE_KEYS[mappingKey];
    if (topLevelKey) {
      client[topLevelKey] = value;
      continue;
    }

    const intakeKey = INTAKE_RESPONSE_KEYS[mappingKey];
    if (intakeKey) intake[intakeKey] = value;
  }

  return { client, intake };
}

function resolvePrefill(
  fields: FormFieldShape[],
  client: {
    email: string;
    phone: string;
    businessName: string;
    primaryContactName: string;
    website?: string | null;
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
    program: intake.programOfInterest ?? '',
    budget: intake.budgetNeed ?? '',
  };

  for (const field of fields) {
    let value = '';
    if (field.prefillKey && byKey[field.prefillKey]) {
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
  constructor(private readonly prisma: PrismaService) {}

  async getPublicForm(token: string) {
    const assignment = await this.prisma.cfFormAssignment.findUnique({
      where: { secureLinkToken: token },
    });
    if (!assignment) throw new NotFoundException('Form link not found.');

    const [template, client, program] = await Promise.all([
      this.prisma.cfFormTemplate.findFirst({
        where: { id: assignment.formId, organizationId: assignment.organizationId },
      }),
      this.prisma.cfClient.findFirst({
        where: { id: assignment.clientId, organizationId: assignment.organizationId },
      }),
      this.prisma.cfProgram.findFirst({
        where: { organizationId: assignment.organizationId, defaultFormTemplateId: assignment.formId },
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

    const fields = (Array.isArray(template.fields) ? template.fields : []) as unknown as FormFieldShape[];
    const prefill = client
      ? resolvePrefill(fields, {
          email: client.email,
          phone: client.phone,
          businessName: client.businessName,
          primaryContactName: client.primaryContactName,
          website: client.website,
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
        fields: fields.map(({ id, label, type, required, options }) => ({
          id,
          label,
          type,
          required,
          ...(options?.length ? { options } : {}),
        })),
      },
      program: {
        name: program?.name ?? 'EA Management Program',
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

    const nonSubmittable = ['submitted', 'approved', 'cancelled', 'expired'];
    if (nonSubmittable.includes(assignment.status)) {
      throw new BadRequestException(`This form has already been ${assignment.status}.`);
    }

    const [template, existingClient] = await Promise.all([
      this.prisma.cfFormTemplate.findFirst({
        where: { id: assignment.formId, organizationId: assignment.organizationId },
      }),
      this.prisma.cfClient.findFirst({
        where: { id: assignment.clientId, organizationId: assignment.organizationId },
      }),
    ]);
    if (!template) throw new NotFoundException('Form configuration not found.');
    if (!existingClient) throw new NotFoundException('Client record not found.');

    const fields = (Array.isArray(template.fields) ? template.fields : []) as unknown as FormFieldShape[];
    const responseEntries = Object.entries(dto.responses);
    if (responseEntries.some(([, value]) => typeof value !== 'string')) {
      throw new BadRequestException('Every form response must be text.');
    }

    const missingFields = fields.filter(
      (field) => field.required && !dto.responses[field.id]?.trim(),
    );
    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Please complete: ${missingFields.map((field) => field.label).join(', ')}.`,
      );
    }

    const mapped = mapResponsesToClient(
      fields,
      dto.responses,
      (existingClient.intake ?? {}) as ClientIntake,
    );
    const now = new Date();
    const EARLY_STAGE_STATUSES = new Set(['New Intake', 'Screening', 'Applied']);

    await this.prisma.$transaction(async (tx) => {
      await tx.cfFormAssignment.update({
        where: { id: assignment.id },
        data: {
          status: 'submitted',
          responses: dto.responses as Prisma.InputJsonValue,
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
          intake: mapped.intake as Prisma.InputJsonValue,
          ...(template.programId ? { programId: template.programId } : {}),
          ...(EARLY_STAGE_STATUSES.has(existingClient.status) ? { status: 'Qualified' } : {}),
        },
      });

      await tx.cfActivityLog.create({
        data: {
          organizationId: assignment.organizationId,
          clientId: assignment.clientId,
          action: 'Form submitted',
          description: `Secure-link form submitted (${assignment.formId}).`,
          user: 'client',
          timestamp: now,
        },
      });
    });

    return { success: true };
  }
}
