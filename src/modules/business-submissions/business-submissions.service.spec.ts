import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { BusinessSubmissionsService } from './business-submissions.service';
import type { CreateBusinessSubmissionDto } from './dto/create-business-submission.dto';

describe('BusinessSubmissionsService.createSubmission', () => {
  function makeService(program: { id: string } | null) {
    const created = { id: 'sub-1', status: 'pending_review' };
    const prisma = {
      program: { findFirst: jest.fn().mockResolvedValue(program) },
      businessSubmission: { create: jest.fn().mockResolvedValue(created) },
    };
    const notifications = { sendAdminReviewAlert: jest.fn().mockResolvedValue(undefined) };
    const service = new BusinessSubmissionsService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
    return { created, prisma, notifications, service };
  }

  const dto = {
    payload: { name: '  Golden Fork  ', city: 'Detroit' },
    submittedByName: 'Golden Fork',
    submittedByEmail: 'owner@example.com',
  } as unknown as CreateBusinessSubmissionDto;

  it('saves the submission and alerts admins that it awaits review', async () => {
    const { created, prisma, notifications, service } = makeService({ id: 'prog-1' });

    await expect(service.createSubmission('fba-app', dto)).resolves.toBe(created);

    expect(prisma.businessSubmission.create).toHaveBeenCalledTimes(1);
    expect(notifications.sendAdminReviewAlert).toHaveBeenCalledWith({
      kind: 'submission',
      programId: 'prog-1',
      businessName: 'Golden Fork',
    });
  });

  it('does not alert admins when the program does not exist', async () => {
    const { notifications, service } = makeService(null);

    await expect(service.createSubmission('missing', dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(notifications.sendAdminReviewAlert).not.toHaveBeenCalled();
  });
});
