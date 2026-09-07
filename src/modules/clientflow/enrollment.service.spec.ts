import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { CfEnrollmentStatus } from '../../generated/clientflow';
import type { ClientflowPrismaService } from '../../prisma/clientflow-prisma.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentService } from './enrollment.service';

describe('EnrollmentService attribution', () => {
  const transaction = {
    cfProgramEnrollment: { create: jest.fn(), update: jest.fn() },
    cfEnrollmentStatusHistory: { create: jest.fn() },
  };
  const prisma = {
    cfClient: { findFirst: jest.fn() },
    cfProgram: { findFirst: jest.fn() },
    cfProgramEnrollment: { findFirst: jest.fn() },
    $transaction: jest.fn((operation: (tx: typeof transaction) => unknown) => operation(transaction)),
  };
  const primaryPrisma = {
    adminUser: { findFirst: jest.fn() },
  };
  const request = {
    headers: { 'x-org-id': 'org-1', 'x-admin-id': 'actor-1' },
  } as unknown as PartitionRequest;

  function createService() {
    return new EnrollmentService(
      request,
      prisma as unknown as ClientflowPrismaService,
      primaryPrisma as unknown as PrismaService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cfClient.findFirst.mockResolvedValue({ id: 'client-1', isDemo: false });
    prisma.cfProgram.findFirst.mockResolvedValue({ id: 'program-1' });
  });

  it('defaults a new enrollment to the authenticated admin with email fallback', async () => {
    primaryPrisma.adminUser.findFirst.mockResolvedValue({
      id: 'actor-1',
      email: 'owner@example.com',
      firstName: null,
      lastName: null,
    });
    transaction.cfProgramEnrollment.create.mockResolvedValue({
      id: 'enrollment-1',
      status: CfEnrollmentStatus.interested,
    });

    await createService().create({ clientId: 'client-1', programId: 'program-1' });

    expect(transaction.cfProgramEnrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assignedUserId: 'actor-1',
        assignedStaff: 'owner@example.com',
        lastModifiedByUserId: 'actor-1',
        lastModifiedByDisplayName: 'owner@example.com',
      }),
    });
    expect(transaction.cfEnrollmentStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedByUserId: 'actor-1',
        changedByDisplayName: 'owner@example.com',
      }),
    });
  });

  it('keeps an explicit assignee distinct from the admin who changes status', async () => {
    primaryPrisma.adminUser.findFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'actor-1'
        ? { id: 'actor-1', email: 'actor@example.com', firstName: 'Alex', lastName: 'Admin' }
        : { id: 'staff-1', email: 'staff@example.com', firstName: 'Erin', lastName: 'Advisor' }),
    );
    prisma.cfProgramEnrollment.findFirst.mockResolvedValue({
      id: 'enrollment-1',
      organizationId: 'org-1',
      status: CfEnrollmentStatus.interested,
    });
    transaction.cfProgramEnrollment.update.mockResolvedValue({ id: 'enrollment-1' });

    await createService().update('enrollment-1', {
      assignedUserId: 'staff-1',
      status: CfEnrollmentStatus.active,
      statusReason: 'Accepted into the program.',
    });

    expect(transaction.cfProgramEnrollment.update).toHaveBeenCalledWith({
      where: { id: 'enrollment-1' },
      data: expect.objectContaining({
        assignedUserId: 'staff-1',
        assignedStaff: 'Erin Advisor',
        lastModifiedByUserId: 'actor-1',
        lastModifiedByDisplayName: 'Alex Admin',
      }),
    });
    expect(transaction.cfEnrollmentStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changedByUserId: 'actor-1',
        changedByDisplayName: 'Alex Admin',
        reason: 'Accepted into the program.',
      }),
    });
  });
});