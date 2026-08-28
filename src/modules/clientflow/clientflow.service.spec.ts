import { NotFoundException } from '@nestjs/common';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { Prisma } from '../../generated/clientflow';
import type { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { ClientflowService } from './clientflow.service';

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