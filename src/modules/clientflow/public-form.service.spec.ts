import type { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import { PublicFormService, RenderedSection } from './public-form.service';

describe('PublicFormService.submitPublicForm', () => {
  const assignment = {
    id: 'assignment-1',
    organizationId: 'org-1',
    clientId: 'client-1',
    formId: 'form-1',
    status: 'opened',
    recipientEmail: 'old@example.com',
    deliveryMethod: 'email',
    isDemo: false,
    startedAt: null,
  };
  const client = {
    id: 'client-1',
    primaryContactName: 'Old Name',
    businessName: 'Old Business',
    email: 'old@example.com',
    phone: '555-0000',
    website: null,
    socialLinks: [],
    intake: { additionalComments: 'Keep this note' },
    assignedUserId: 'user-1',
    assignedStaff: 'Taylor',
    isDemo: false,
  };
  const renderedSections: RenderedSection[] = [
    {
      id: 'core:form-1:1',
      kind: 'core',
      templateId: 'form-1',
      templateVersion: 1,
      programId: null,
      title: 'Master Intake',
      description: '',
      fields: [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'business', label: 'Business name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'phone', label: 'Phone', type: 'phone', required: true },
        { id: 'website', label: 'Website', type: 'url', required: false },
        { id: 'instagramUrl', label: 'Instagram URL', type: 'url', required: false },
        { id: 'businessType', label: 'Business type', type: 'text', required: true },
        { id: 'description', label: 'Business description', type: 'textarea', required: true },
        { id: 'assistance', label: 'Assistance needed', type: 'textarea', required: true },
        { id: 'budget', label: 'Estimated budget', type: 'number', required: false },
        { id: 'start', label: 'Desired start date', type: 'date', required: false },
        { id: 'contact', label: 'Preferred contact method', type: 'select', required: false },
        { id: 'heard', label: 'How did you hear about us?', type: 'text', required: false },
      ],
    },
    {
      id: 'program:program-1:section-1:1',
      kind: 'program',
      templateId: 'section-1',
      templateVersion: 1,
      programId: 'program-1',
      title: 'Accelerator questions',
      description: '',
      fields: [
        { id: 'growthGoal', label: 'Growth goal', type: 'text', required: true },
        { id: 'businessLicense', label: 'Business license', type: 'file', required: true },
        {
          id: 'stage', label: 'Business stage', type: 'select', required: true,
          options: ['Idea Stage', 'Pre-Revenue'],
        },
        {
          id: 'revenue', label: 'Revenue stage', type: 'select', required: true,
          options: ['$0', 'Under $1,000'],
        },
        { id: 'agreement', label: 'I Accept', type: 'checkbox', required: true },
        { id: 'signature', label: 'Signature', type: 'signature', required: true },
      ],
    },
  ];

  function setup(existingEnrollments: Array<{ id: string; programId: string; startDate: Date | null }> = []) {
    const tx = {
      cfIntakeSubmission: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'submission-1' }),
      },
      cfProgramEnrollment: {
        findMany: jest.fn().mockResolvedValue(existingEnrollments),
        create: jest.fn().mockResolvedValue({
          id: 'enrollment-1', programId: 'program-1', startDate: new Date('2026-10-15'),
        }),
        update: jest.fn().mockResolvedValue({ id: 'enrollment-1' }),
      },
      cfEnrollmentStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      cfIntakeSubmissionSnapshot: { create: jest.fn().mockResolvedValue({}) },
      cfIntakeSubmissionProgram: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      cfFormAssignment: { update: jest.fn().mockResolvedValue({}) },
      cfClient: { update: jest.fn().mockResolvedValue({}) },
      cfActivityLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      cfFormAssignment: { findUnique: jest.fn().mockResolvedValue(assignment) },
      cfIntakeSubmission: { findFirst: jest.fn().mockResolvedValue(null) },
      cfClient: { findFirst: jest.fn().mockResolvedValue(client) },
      cfIntakeRenderSession: {
        findFirst: jest.fn().mockResolvedValue({
          coreTemplateId: 'form-1',
          coreTemplateVersion: 1,
          renderedSections,
        }),
      },
      cfProgram: { findMany: jest.fn().mockResolvedValue([{ id: 'program-1' }]) },
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    return {
      service: new PublicFormService(prisma as unknown as ClientflowPrismaService),
      prisma,
      tx,
    };
  }

  const dto = {
    configurationToken: 'configuration-1',
    idempotencyKey: 'request-1',
    selectedProgramIds: ['program-1'],
    coreResponses: {
      name: 'Jordan Lee',
      business: 'North Star Studio',
      email: 'jordan@example.com',
      phone: '555-0102',
      website: 'https://northstar.example',
      instagramUrl: 'https://instagram.com/northstar',
      businessType: 'Creative agency',
      description: 'A growing design studio',
      assistance: 'Operations and hiring support',
      budget: '25000',
      start: '2026-10-15',
      contact: 'Cell number',
      heard: 'Community event',
    },
    programResponses: {
      'program-1': {
        growthGoal: 'Hire two designers',
        stage: 'Pre-Revenue',
        revenue: 'Under $1,000',
        agreement: 'true',
        signature: 'Jordan Lee',
      },
    },
  };

  it('updates the client and links answers and start date to the selected program', async () => {
    const { service, tx } = setup();

    await expect(service.submitPublicForm('secure-token', dto)).resolves.toEqual({
      success: true,
      enrollmentIds: ['enrollment-1'],
    });

    expect(tx.cfClient.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: expect.objectContaining({
        primaryContactName: 'Jordan Lee',
        businessName: 'North Star Studio',
        email: 'jordan@example.com',
        phone: '555-0102',
        website: 'https://northstar.example',
        socialLinks: ['https://instagram.com/northstar'],
        intake: {
          additionalComments: 'Keep this note',
          businessType: 'Creative agency',
          businessDescription: 'A growing design studio',
          assistanceRequested: 'Operations and hiring support',
          budgetNeed: '25000',
          preferredContact: 'Cell number',
          heardAboutUs: 'Community event',
        },
      }),
    });
    expect(tx.cfProgramEnrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientId: 'client-1',
        programId: 'program-1',
        status: 'interested',
        startDate: new Date('2026-10-15'),
      }),
    });
    expect(tx.cfIntakeSubmissionProgram.createMany).toHaveBeenCalledWith({
      data: [{
        organizationId: 'org-1',
        intakeSubmissionId: 'submission-1',
        programId: 'program-1',
        enrollmentId: 'enrollment-1',
        responsePayload: {
          growthGoal: 'Hire two designers',
          stage: 'Pre-Revenue',
          revenue: 'Under $1,000',
          agreement: 'true',
          signature: 'Jordan Lee',
        },
      }],
    });
  });

  it('does not replace a start date already established on an existing enrollment', async () => {
    const establishedStartDate = new Date('2026-09-01');
    const { service, tx } = setup([{
      id: 'enrollment-1', programId: 'program-1', startDate: establishedStartDate,
    }]);

    await service.submitPublicForm('secure-token', dto);

    expect(tx.cfProgramEnrollment.create).not.toHaveBeenCalled();
    expect(tx.cfProgramEnrollment.update).not.toHaveBeenCalled();
  });

  it('fills a blank start date on an existing selected program enrollment', async () => {
    const { service, tx } = setup([{
      id: 'enrollment-1', programId: 'program-1', startDate: null,
    }]);

    await service.submitPublicForm('secure-token', dto);

    expect(tx.cfProgramEnrollment.create).not.toHaveBeenCalled();
    expect(tx.cfProgramEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: { startDate: new Date('2026-10-15') },
    });
  });

  it('still rejects a missing required non-file program answer', async () => {
    const { service, prisma } = setup();
    const missingGrowthGoal = {
      ...dto,
      idempotencyKey: 'request-missing-growth-goal',
      programResponses: {
        'program-1': { ...dto.programResponses['program-1'], growthGoal: '' },
      },
    };

    await expect(service.submitPublicForm('secure-token', missingGrowthGoal))
      .rejects.toThrow('Please complete: Growth goal.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an unchecked required acceptance checkbox', async () => {
    const { service, prisma } = setup();
    const unchecked = {
      ...dto,
      idempotencyKey: 'request-unchecked',
      programResponses: {
        'program-1': { ...dto.programResponses['program-1'], agreement: 'false' },
      },
    };

    await expect(service.submitPublicForm('secure-token', unchecked))
      .rejects.toThrow('Please complete: I Accept.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects select values outside the rendered options', async () => {
    const { service, prisma } = setup();
    const tampered = {
      ...dto,
      idempotencyKey: 'request-tampered',
      programResponses: {
        'program-1': { ...dto.programResponses['program-1'], revenue: '$1,000,000+' },
      },
    };

    await expect(service.submitPublicForm('secure-token', tampered))
      .rejects.toThrow('Please correct: Revenue stage.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a typed signature longer than 200 characters', async () => {
    const { service, prisma } = setup();
    const oversized = {
      ...dto,
      idempotencyKey: 'request-oversized-signature',
      programResponses: {
        'program-1': { ...dto.programResponses['program-1'], signature: 'x'.repeat(201) },
      },
    };

    await expect(service.submitPublicForm('secure-token', oversized))
      .rejects.toThrow('Please correct: Signature.');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});