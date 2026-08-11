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

    const now = new Date();

    await this.prisma.cfFormAssignment.update({
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

    const [program, existingClient] = await Promise.all([
      this.prisma.cfProgram.findFirst({
        where: {
          organizationId: assignment.organizationId,
          defaultFormTemplateId: assignment.formId,
        },
      }),
      this.prisma.cfClient.findFirst({
        where: { id: assignment.clientId },
        select: { status: true },
      }),
    ]);

    const EARLY_STAGE_STATUSES = new Set(['New Intake', 'Screening', 'Applied']);
    await this.prisma.cfClient.update({
      where: { id: assignment.clientId },
      data: {
        ...(program ? { programId: program.id } : {}),
        ...(existingClient && EARLY_STAGE_STATUSES.has(existingClient.status)
          ? { status: 'Qualified' }
          : {}),
      },
    });

    await this.prisma.cfActivityLog.create({
      data: {
        organizationId: assignment.organizationId,
        clientId: assignment.clientId,
        action: 'Form submitted',
        description: `Secure-link form submitted (${assignment.formId}).`,
        user: 'client',
        timestamp: now,
      },
    });

    return { success: true };
  }
}
