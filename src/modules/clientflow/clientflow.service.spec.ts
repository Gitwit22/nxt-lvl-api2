import { BadRequestException, NotFoundException } from '@nestjs/common';
import { compare } from 'bcrypt';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { Prisma } from '../../generated/clientflow';
import type { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { FilesService } from '../files/files.service';
import { ClientflowService } from './clientflow.service';

jest.mock('bcrypt', () => ({ compare: jest.fn() }));

describe('ClientflowService.getProgramDetail', () => {
  const prisma = {
    cfProgram: { findFirst: jest.fn() },
    cfProgramEnrollment: { findMany: jest.fn() },
    cfClient: { findMany: jest.fn() },
    cfIntakeSubmissionProgram: { findMany: jest.fn() },
    cfFormAssignment: { findMany: jest.fn() },
    cfTerms: { findMany: jest.fn() },
    cfContract: { findMany: jest.fn() },
    cfEnrollmentMonitoring: { findMany: jest.fn() },
    cfIntakeSubmission: { findMany: jest.fn() },
    cfIntakeSubmissionSnapshot: { findMany: jest.fn() },
    cfFormTemplate: { findMany: jest.fn() },
  };
  const request = {
    headers: { 'x-org-id': 'org-1' },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  function createService() {
    return new ClientflowService(
      request,
      prisma as unknown as ClientflowPrismaService,
      {} as PrismaService,
      {} as NotificationsService,
      {} as FilesService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cfProgramEnrollment.findMany.mockResolvedValue([]);
    prisma.cfClient.findMany.mockResolvedValue([]);
    prisma.cfIntakeSubmissionProgram.findMany.mockResolvedValue([]);
    prisma.cfFormAssignment.findMany.mockResolvedValue([]);
    prisma.cfTerms.findMany.mockResolvedValue([]);
    prisma.cfContract.findMany.mockResolvedValue([]);
    prisma.cfEnrollmentMonitoring.findMany.mockResolvedValue([]);
    prisma.cfIntakeSubmission.findMany.mockResolvedValue([]);
    prisma.cfIntakeSubmissionSnapshot.findMany.mockResolvedValue([]);
    prisma.cfFormTemplate.findMany.mockResolvedValue([]);
  });

  it('returns labeled replies and enrollment-scoped progress records', async () => {
    const submittedAt = new Date('2026-08-20T12:00:00.000Z');
    prisma.cfProgram.findFirst.mockResolvedValue({
      id: 'program-1',
      organizationId: 'org-1',
      name: 'Accelerator',
      description: 'Growth support',
      isActive: true,
    });
    prisma.cfProgramEnrollment.findMany.mockResolvedValue([{
      id: 'enrollment-1',
      organizationId: 'org-1',
      clientId: 'client-1',
      programId: 'program-1',
      status: 'active',
      progressPercentage: 40,
      isArchived: false,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    }]);
    prisma.cfClient.findMany.mockResolvedValue([{
      id: 'client-1',
      businessName: 'North Star Studio',
      primaryContactName: 'Sam Taylor',
      email: 'sam@example.com',
      phone: '555-0100',
    }]);
    prisma.cfIntakeSubmissionProgram.findMany.mockResolvedValue([{
      id: 'link-1',
      intakeSubmissionId: 'submission-1',
      programId: 'program-1',
      enrollmentId: 'enrollment-1',
      responsePayload: { growthGoal: 'Hire two people' },
      createdAt: submittedAt,
    }]);
    prisma.cfIntakeSubmission.findMany.mockResolvedValue([{
      id: 'submission-1',
      clientId: 'client-1',
      responsePayload: { businessDescription: 'Design agency' },
      submittedAt,
    }]);
    prisma.cfIntakeSubmissionSnapshot.findMany.mockResolvedValue([{
      intakeSubmissionId: 'submission-1',
      renderedSections: [
        {
          id: 'core',
          kind: 'core',
          programId: null,
          title: 'About your business',
          fields: [{ id: 'businessDescription', label: 'Business description' }],
        },
        {
          id: 'program',
          kind: 'program',
          programId: 'program-1',
          title: 'Accelerator questions',
          fields: [{ id: 'growthGoal', label: 'What is your growth goal?' }],
        },
      ],
    }]);
    prisma.cfFormAssignment.findMany.mockResolvedValue([{
      id: 'assignment-1',
      clientId: 'client-1',
      enrollmentId: 'enrollment-1',
      formId: 'form-1',
      status: 'submitted',
      responses: { revenue: 125000 },
      submittedAt,
      createdAt: submittedAt,
    }]);
    prisma.cfFormTemplate.findMany.mockResolvedValue([{
      id: 'form-1',
      programId: 'program-1',
      name: 'Financial update',
      fields: [{ id: 'revenue', label: 'Annual revenue' }],
    }]);
    prisma.cfTerms.findMany.mockResolvedValue([
      { id: 'terms-1', clientId: 'client-1', enrollmentId: 'enrollment-1' },
      { id: 'terms-other', clientId: 'client-1', enrollmentId: 'enrollment-other' },
    ]);

    const result = await createService().getProgramDetail('program-1');

    expect(result.summary).toEqual({ current: 1, completed: 0, closed: 0 });
    expect(result.participants).toHaveLength(1);
    expect(result.participants[0].coreIntake[0].answers[0]).toEqual({
      fieldId: 'businessDescription',
      label: 'Business description',
      value: 'Design agency',
    });
    expect(result.participants[0].programIntake[0].answers[0].label)
      .toBe('What is your growth goal?');
    expect(result.participants[0].forms[0].answers[0].label).toBe('Annual revenue');
    expect(result.participants[0].terms).toEqual([
      { id: 'terms-1', clientId: 'client-1', enrollmentId: 'enrollment-1' },
    ]);
    expect(prisma.cfProgram.findFirst).toHaveBeenCalledWith({
      where: { id: 'program-1', organizationId: 'org-1' },
    });
  });

  it('returns empty optional sections for an enrollment without replies or progress records', async () => {
    prisma.cfProgram.findFirst.mockResolvedValue({ id: 'program-1', name: 'Accelerator' });
    prisma.cfProgramEnrollment.findMany.mockResolvedValue([{
      id: 'enrollment-1',
      clientId: 'client-1',
      programId: 'program-1',
      status: 'pending_review',
    }]);
    prisma.cfClient.findMany.mockResolvedValue([{
      id: 'client-1',
      businessName: 'New Company',
      primaryContactName: 'Alex Smith',
      email: 'alex@example.com',
      phone: '555-0101',
    }]);

    const result = await createService().getProgramDetail('program-1');

    expect(result.participants[0]).toMatchObject({
      coreIntake: [],
      programIntake: [],
      forms: [],
      terms: [],
      contracts: [],
      monitoring: [],
    });
  });

  it('returns program details when the optional monitoring table is not deployed yet', async () => {
    prisma.cfProgram.findFirst.mockResolvedValue({ id: 'program-1', name: 'Accelerator' });
    prisma.cfProgramEnrollment.findMany.mockResolvedValue([{
      id: 'enrollment-1',
      clientId: 'client-1',
      programId: 'program-1',
      status: 'active',
    }]);
    prisma.cfClient.findMany.mockResolvedValue([{
      id: 'client-1',
      businessName: 'New Company',
      primaryContactName: 'Alex Smith',
      email: 'alex@example.com',
      phone: '555-0101',
    }]);
    prisma.cfEnrollmentMonitoring.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Table does not exist', {
        code: 'P2021',
        clientVersion: '6.16.3',
      }),
    );

    const result = await createService().getProgramDetail('program-1');

    expect(result.participants[0].monitoring).toEqual([]);
  });

  it('does not hide unrelated monitoring database failures', async () => {
    prisma.cfProgram.findFirst.mockResolvedValue({ id: 'program-1', name: 'Accelerator' });
    prisma.cfEnrollmentMonitoring.findMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Query failed', {
        code: 'P2002',
        clientVersion: '6.16.3',
      }),
    );

    await expect(createService().getProgramDetail('program-1'))
      .rejects.toMatchObject({ code: 'P2002' });
  });

  it('does not reveal a missing or cross-organization program', async () => {
    prisma.cfProgram.findFirst.mockResolvedValue(null);

    await expect(createService().getProgramDetail('program-other'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.cfProgramEnrollment.findMany).not.toHaveBeenCalled();
  });
});

describe('ClientflowService program form linkage', () => {
  const request = {
    headers: { 'x-org-id': 'org-1' },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  function setup(templateProgramId: string | null) {
    const tx = {
      cfProgram: {
        findFirst: jest.fn().mockResolvedValue({ id: 'program-1', organizationId: 'org-1' }),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'program-1', ...data })),
      },
      cfFormTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'form-1',
          organizationId: 'org-1',
          programId: templateProgramId,
          scope: 'legacy',
          isActive: true,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const service = new ClientflowService(
      request,
      prisma as unknown as ClientflowPrismaService,
      {} as PrismaService,
      {} as NotificationsService,
      {} as FilesService,
    );
    return { service, tx };
  }

  it('ties an unassigned default form back to the program', async () => {
    const { service, tx } = setup(null);

    const updated = await service.updateProgram('program-1', { defaultFormTemplateId: 'form-1' });

    expect(updated).toMatchObject({ id: 'program-1', defaultFormTemplateId: 'form-1' });
    expect(tx.cfFormTemplate.update).toHaveBeenCalledWith({
      where: { id: 'form-1' },
      data: { programId: 'program-1', scope: 'program_section' },
    });
  });

  it('does not steal a form belonging to another program', async () => {
    const { service, tx } = setup('program-2');

    await expect(service.updateProgram('program-1', { defaultFormTemplateId: 'form-1' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.cfFormTemplate.update).not.toHaveBeenCalled();
    expect(tx.cfProgram.update).not.toHaveBeenCalled();
  });
});

describe('ClientflowService form template persistence', () => {
  const request = {
    headers: { 'x-org-id': 'org-1' },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  it('returns the saved program questions unchanged after a reload', async () => {
    const restoredQuestions = [
      {
        id: 'brandType',
        label: 'What best describes your brand?',
        type: 'select',
        required: true,
      },
      {
        id: 'contentType',
        label: 'What type of content do you create?',
        type: 'select',
        required: true,
      },
    ];
    const submittedQuestions = [
      ...restoredQuestions,
      {
        id: '  growth-goal  ',
        label: '  What is your growth goal?  ',
        type: 'textarea',
        required: true,
        helpText: 'Describe the next twelve months.',
      },
    ];
    const editedQuestions = [
      ...restoredQuestions,
      {
        id: 'growth-goal',
        label: 'What is your growth goal?',
        type: 'textarea',
        required: true,
        helpText: 'Describe the next twelve months.',
      },
    ];
    let persistedTemplate = {
      id: 'form-creator',
      organizationId: 'org-1',
      programId: 'prog-creator',
      scope: 'program_section',
      version: 1,
      sortOrder: 0,
      name: 'Creator & Brand Digital Growth Intake',
      description: '',
      fields: restoredQuestions as unknown[],
      emailTemplate: 'default',
      internalNotes: null,
      dueInDays: 7,
      isActive: true,
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      updatedAt: new Date('2026-08-31T12:00:00.000Z'),
    };
    const prisma = {
      cfFormTemplate: {
        findFirst: jest.fn().mockImplementation(async () => persistedTemplate),
        update: jest.fn().mockImplementation(async ({ data }) => {
          const version = typeof data.version === 'object' && data.version.increment
            ? persistedTemplate.version + data.version.increment
            : data.version ?? persistedTemplate.version;
          persistedTemplate = { ...persistedTemplate, ...data, version };
          return persistedTemplate;
        }),
        findMany: jest.fn().mockImplementation(async () => [persistedTemplate]),
      },
    };
    const service = new ClientflowService(
      request,
      prisma as unknown as ClientflowPrismaService,
      {} as PrismaService,
      {} as NotificationsService,
      {} as FilesService,
    );

    const updated = await service.updateFormTemplate(persistedTemplate.id, {
      fields: submittedQuestions,
    });
    const [reloaded] = await service.listFormTemplates();

    expect(updated.fields).toEqual(editedQuestions);
    expect(updated.version).toBe(2);
    expect(updated.scope).toBe('program_section');
    expect(reloaded.fields).toEqual(editedQuestions);
    expect(reloaded.scope).toBe('program_section');
    expect(prisma.cfFormTemplate.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fields: editedQuestions, version: { increment: 1 } }),
    }));

    await expect(service.updateFormTemplate(persistedTemplate.id, {
      fields: [
        { id: 'growth-goal', label: 'Growth goal' },
        { id: ' growth-goal ', label: 'Updated growth goal' },
      ],
    })).rejects.toThrow('Duplicate form field ID: growth-goal.');
  });
});

describe('ClientflowService form template deletion', () => {
  const request = {
    headers: { 'x-org-id': 'org-1' },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  function setup(linkedProgramIds: string[] = []) {
    const tx = {
      cfFormTemplate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'form-1', organizationId: 'org-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'form-1' }),
      },
      cfProgram: {
        findMany: jest.fn().mockResolvedValue(linkedProgramIds.map((id) => ({ id }))),
        updateMany: jest.fn().mockResolvedValue({ count: linkedProgramIds.length }),
      },
      cfFormAssignment: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      cfIntakeRenderSession: { deleteMany: jest.fn() },
      cfIntakeSubmissionSnapshot: { deleteMany: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const service = new ClientflowService(
      request,
      prisma as unknown as ClientflowPrismaService,
      {} as PrismaService,
      {} as NotificationsService,
      {} as FilesService,
    );
    return { service, tx };
  }

  it('deletes an unreferenced form template', async () => {
    const { service, tx } = setup();

    await expect(service.deleteFormTemplate('form-1')).resolves.toEqual({
      id: 'form-1',
      unlinkedProgramIds: [],
      cancelledAssignments: 2,
    });
    expect(tx.cfFormTemplate.delete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
  });

  it('unlinks programs, cancels unfinished assignments, and preserves intake history', async () => {
    const { service, tx } = setup(['program-1']);

    await expect(service.deleteFormTemplate('form-1')).resolves.toEqual({
      id: 'form-1',
      unlinkedProgramIds: ['program-1'],
      cancelledAssignments: 2,
    });
    expect(tx.cfProgram.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', id: { in: ['program-1'] } },
      data: { defaultFormTemplateId: '', isActive: false },
    });
    expect(tx.cfFormAssignment.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        formId: 'form-1',
        status: { notIn: ['submitted', 'approved', 'cancelled', 'expired'] },
      },
      data: expect.objectContaining({
        status: 'cancelled',
        secureLink: null,
        secureLinkToken: null,
      }),
    });
    expect(tx.cfIntakeRenderSession.deleteMany).not.toHaveBeenCalled();
    expect(tx.cfIntakeSubmissionSnapshot.deleteMany).not.toHaveBeenCalled();
    expect(tx.cfFormTemplate.delete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
  });
});

describe('ClientflowService notifications', () => {
  const request = {
    headers: { 'x-org-id': 'org-1', 'x-admin-id': 'admin-1' },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  function setup() {
    const prisma = {
      cfNotification: {
        findMany: jest.fn().mockResolvedValue([{ id: 'notification-1', readAt: null }]),
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      },
    };
    const service = new ClientflowService(
      request,
      prisma as unknown as ClientflowPrismaService,
      {} as PrismaService,
      {} as NotificationsService,
      {} as FilesService,
    );
    return { service, prisma };
  }

  it('lists only the current admin notifications and returns the unread count', async () => {
    const { service, prisma } = setup();

    await expect(service.listNotifications(20)).resolves.toEqual({
      items: [{ id: 'notification-1', readAt: null }],
      unreadCount: 1,
    });
    expect(prisma.cfNotification.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', recipientAdminId: 'admin-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  });

  it('marks one notification read within the current admin scope', async () => {
    const { service, prisma } = setup();

    await expect(service.markNotificationRead('notification-1')).resolves.toEqual({
      id: 'notification-1',
      read: true,
    });
    expect(prisma.cfNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'notification-1',
        organizationId: 'org-1',
        recipientAdminId: 'admin-1',
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it('marks all current admin notifications read', async () => {
    const { service, prisma } = setup();

    await expect(service.markAllNotificationsRead()).resolves.toEqual({ updated: 1 });
    expect(prisma.cfNotification.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', recipientAdminId: 'admin-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe('ClientflowService actor attribution', () => {
  const request = {
    headers: { 'x-org-id': 'org-1', 'x-admin-id': 'admin-1' },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  function setup() {
    const prisma = {
      cfClient: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
      cfFormTemplate: { findFirst: jest.fn().mockResolvedValue({ id: 'form-1', programId: null }) },
      cfFormAssignment: { create: jest.fn().mockImplementation(({ data }) => data) },
      cfActivityLog: { create: jest.fn().mockImplementation(({ data }) => data) },
    };
    const primaryPrisma = {
      adminUser: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-1',
          organizationId: 'org-1',
          email: 'admin@example.com',
          firstName: 'Jordan',
          lastName: 'Lee',
          isActive: true,
        }),
      },
    };
    const service = new ClientflowService(
      request,
      prisma as unknown as ClientflowPrismaService,
      primaryPrisma as unknown as PrismaService,
      {} as NotificationsService,
      {} as FilesService,
    );
    return { service, prisma, primaryPrisma };
  }

  it('attributes new activities to the authenticated admin', async () => {
    const { service, prisma } = setup();

    await service.createActivity({
      clientId: 'client-1',
      action: 'Client updated',
      description: 'Contact details changed.',
    });

    expect(prisma.cfActivityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        actorUserId: 'admin-1',
        user: 'Jordan Lee',
        timestamp: expect.any(Date),
      }),
    });
  });

  it('uses the authenticated admin ID as the form creator', async () => {
    const { service, prisma } = setup();

    await service.createFormAssignment({ clientId: 'client-1', formId: 'form-1' });

    expect(prisma.cfFormAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdByUserId: 'admin-1' }),
    });
  });
});

describe('ClientflowService.removeDemo', () => {
  it('completes the live-mode transition when the partition has no AuditLog table', async () => {
    const request = {
      headers: { 'x-org-id': 'org-1', 'x-admin-id': 'admin-1' },
      partition: { appUrl: 'https://clientflow.test' },
    } as unknown as PartitionRequest;
    const primaryPrisma = {
      adminUser: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'admin-1',
          organizationId: 'org-1',
          role: 'org_admin',
          isActive: true,
          passwordHash: 'hash',
        }),
      },
      organization: {
        findUnique: jest.fn().mockResolvedValue({
          liveMode: false,
          demoRemovedAt: null,
          principalAdminId: null,
        }),
      },
      auditLog: {
        create: jest.fn().mockRejectedValue({ code: 'P2021' }),
      },
      $transaction: jest.fn(async (callback) => callback({
        organization: {
          findUnique: jest.fn().mockResolvedValue({ liveMode: false }),
          update: jest.fn().mockResolvedValue({
            liveMode: true,
            demoRemovedAt: new Date('2026-08-30T12:00:00.000Z'),
            principalAdminId: 'admin-1',
          }),
        },
      })),
    };
    const service = new ClientflowService(
      request,
      {} as ClientflowPrismaService,
      primaryPrisma as unknown as PrismaService,
      {} as NotificationsService,
      {} as FilesService,
    );
    const deletePersistedDemoData = jest.fn().mockResolvedValue({ clients: 3 });
    Object.assign(service, { deletePersistedDemoData });
    jest.mocked(compare).mockResolvedValue(true as never);

    const result = await service.removeDemo({
      currentPassword: 'correct-password',
      confirmation: 'REMOVE DEMO DATA',
    });

    expect(result).toMatchObject({
      liveMode: true,
      principalAdminId: 'admin-1',
      removed: { clients: 3 },
    });
    expect(deletePersistedDemoData).toHaveBeenCalledWith('org-1');
    expect(primaryPrisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});

describe('ClientflowService document storage', () => {
  const originalBucketName = process.env['CLIENTFLOW_R2_BUCKET_NAME'];
  const request = {
    headers: { 'x-org-id': 'org-1', 'x-admin-email': 'admin@example.com' },
    partition: { appUrl: 'https://clientflow.test' },
  } as unknown as PartitionRequest;

  afterAll(() => {
    if (originalBucketName === undefined) delete process.env['CLIENTFLOW_R2_BUCKET_NAME'];
    else process.env['CLIENTFLOW_R2_BUCKET_NAME'] = originalBucketName;
  });

  function setup() {
    const prisma = {
      cfClient: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
      cfDocument: {
        create: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const files = {
      createFileUrl: jest.fn(),
      getBucketName: jest.fn().mockReturnValue('fallback-bucket'),
      getObjectMetadata: jest.fn(),
      getStorageKey: jest.fn().mockReturnValue('clientflow-hub/organizations/org-1/document-1'),
    };
    const service = new ClientflowService(
      request,
      prisma as unknown as ClientflowPrismaService,
      {} as PrismaService,
      {} as NotificationsService,
      files as unknown as FilesService,
    );
    return { files, prisma, service };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['CLIENTFLOW_R2_BUCKET_NAME'] = 'eamanagement';
  });

  it('persists and presigns new uploads with the dedicated bucket', async () => {
    const { files, prisma, service } = setup();
    const document = { id: 'document-1', bucket: 'eamanagement' };
    prisma.cfDocument.create.mockResolvedValue(document);
    files.createFileUrl.mockResolvedValue({
      bucketName: 'eamanagement',
      objectKey: 'clientflow-hub/organizations/org-1/document-1',
      url: 'https://upload.test',
      expiresInSeconds: 900,
    });

    await expect(service.createDocumentUpload('client-1', {
      name: 'application.pdf',
      type: 'application/pdf',
      byteSize: 128,
    })).resolves.toMatchObject({ document, uploadUrl: 'https://upload.test' });

    expect(prisma.cfDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bucket: 'eamanagement' }),
    });
    expect(files.createFileUrl).toHaveBeenCalledWith(expect.objectContaining({
      action: 'upload',
      bucketName: 'eamanagement',
    }));
  });

  it('falls back to the existing bucket when no dedicated bucket is configured', async () => {
    delete process.env['CLIENTFLOW_R2_BUCKET_NAME'];
    const { files, prisma, service } = setup();
    prisma.cfDocument.create.mockResolvedValue({ id: 'document-1', bucket: 'fallback-bucket' });
    files.createFileUrl.mockResolvedValue({
      bucketName: 'fallback-bucket',
      objectKey: 'clientflow-hub/organizations/org-1/document-1',
      url: 'https://upload.test',
      expiresInSeconds: 900,
    });

    await service.createDocumentUpload('client-1', {
      name: 'application.pdf',
      type: 'application/pdf',
      byteSize: 128,
    });

    expect(files.getBucketName).toHaveBeenCalledTimes(1);
    expect(prisma.cfDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ bucket: 'fallback-bucket' }),
    });
    expect(files.createFileUrl).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: 'fallback-bucket',
    }));
  });

  it('checks uploaded metadata in the bucket stored on the document', async () => {
    const { files, prisma, service } = setup();
    prisma.cfDocument.findFirst.mockResolvedValue({
      id: 'document-1',
      bucket: 'stored-bucket',
      objectKey: 'clientflow-hub/document-1',
      byteSize: 128,
      type: 'application/pdf',
    });
    prisma.cfDocument.update.mockResolvedValue({ id: 'document-1', uploadStatus: 'ready' });
    files.getObjectMetadata.mockResolvedValue({ byteSize: 128, contentType: 'application/pdf' });

    await service.completeDocumentUpload('document-1');

    expect(files.getObjectMetadata).toHaveBeenCalledWith(
      'clientflow-hub/document-1',
      'stored-bucket',
    );
  });

  it('presigns downloads from the bucket stored on the document', async () => {
    const { files, prisma, service } = setup();
    prisma.cfDocument.findFirst.mockResolvedValue({
      id: 'document-1',
      bucket: 'stored-bucket',
      objectKey: 'clientflow-hub/document-1',
      name: 'application.pdf',
      type: 'application/pdf',
    });
    files.createFileUrl.mockResolvedValue({ url: 'https://download.test', expiresInSeconds: 300 });

    await expect(service.getDocumentDownload('document-1')).resolves.toEqual({
      url: 'https://download.test',
      expiresInSeconds: 300,
    });
    expect(files.createFileUrl).toHaveBeenCalledWith(expect.objectContaining({
      action: 'download',
      bucketName: 'stored-bucket',
    }));
  });
});