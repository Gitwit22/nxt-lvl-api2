import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import type { PrismaService } from '../../prisma/prisma.service';

const execute = jest.fn();

jest.mock('@nxtlvl/notification-core', () => ({
  loadNotificationConfig: () => ({ logLevel: 'error' }),
  ResendEmailProvider: jest.fn(),
  ConsoleEmailLogger: jest.fn(),
  SendEmailUseCase: jest.fn().mockImplementation(() => ({ execute })),
}));

import { NotificationsService, parseAdminRecipients } from './notifications.service';

describe('parseAdminRecipients', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(parseAdminRecipients(' a@x.com, ,b@y.com ,')).toEqual(['a@x.com', 'b@y.com']);
  });

  it('returns no recipients when unset', () => {
    expect(parseAdminRecipients(undefined)).toEqual([]);
  });
});

describe('NotificationsService.sendAdminReviewAlert', () => {
  const originalRecipients = process.env['ADMIN_NOTIFICATION_EMAILS'];
  const originalAppUrl = process.env['APP_URL'];
  const request = {
    partition: { appName: 'BlackNBiz', appUrl: 'https://fbapp.pages.dev' },
  } as unknown as PartitionRequest;

  function makeService(counts: { submissions: number; changeRequests: number }) {
    const prisma = {
      businessSubmission: { count: jest.fn().mockResolvedValue(counts.submissions) },
      businessChangeRequest: { count: jest.fn().mockResolvedValue(counts.changeRequests) },
    };
    return { prisma, service: new NotificationsService(request, prisma as unknown as PrismaService) };
  }

  beforeEach(() => {
    execute.mockReset().mockResolvedValue({ success: true });
    process.env['ADMIN_NOTIFICATION_EMAILS'] = 'admin@example.com, owner@example.com';
    process.env['APP_URL'] = 'https://blacknbiz.com/';
  });

  afterAll(() => {
    if (originalRecipients === undefined) delete process.env['ADMIN_NOTIFICATION_EMAILS'];
    else process.env['ADMIN_NOTIFICATION_EMAILS'] = originalRecipients;
    if (originalAppUrl === undefined) delete process.env['APP_URL'];
    else process.env['APP_URL'] = originalAppUrl;
  });

  it('emails every admin with the awaiting-review totals for the program', async () => {
    const { prisma, service } = makeService({ submissions: 2, changeRequests: 1 });

    await service.sendAdminReviewAlert({ kind: 'submission', programId: 'prog-1', businessName: 'Golden Fork' });

    expect(prisma.businessSubmission.count).toHaveBeenCalledWith({
      where: { programId: 'prog-1', status: 'pending_review' },
    });
    expect(prisma.businessChangeRequest.count).toHaveBeenCalledWith({
      where: { status: 'pending_review', business: { programId: 'prog-1' } },
    });
    expect(execute).toHaveBeenCalledTimes(1);
    const email = execute.mock.calls[0][0];
    expect(email.to).toEqual(['admin@example.com', 'owner@example.com']);
    expect(email.subject).toBe('New listing submitted: Golden Fork (3 awaiting review)');
    expect(email.html).toContain('https://blacknbiz.com/admin');
    expect(email.text).toContain('2 new listings, 1 listing updates');
  });

  it('labels owner edits as listing updates', async () => {
    const { service } = makeService({ submissions: 0, changeRequests: 1 });

    await service.sendAdminReviewAlert({ kind: 'change_request', programId: 'prog-1', businessName: 'Golden Fork' });

    expect(execute.mock.calls[0][0].subject).toBe('Listing update requested: Golden Fork (1 awaiting review)');
  });

  it('escapes the user-supplied business name in the HTML body', async () => {
    const { service } = makeService({ submissions: 1, changeRequests: 0 });

    await service.sendAdminReviewAlert({ kind: 'submission', programId: 'prog-1', businessName: '<script>x</script>' });

    const { html } = execute.mock.calls[0][0];
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });

  it('sends nothing when no admin recipients are configured', async () => {
    delete process.env['ADMIN_NOTIFICATION_EMAILS'];
    const { prisma, service } = makeService({ submissions: 1, changeRequests: 0 });

    await service.sendAdminReviewAlert({ kind: 'submission', programId: 'prog-1', businessName: 'Golden Fork' });

    expect(prisma.businessSubmission.count).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('never throws when the email provider fails', async () => {
    execute.mockRejectedValue(new Error('provider down'));
    const { service } = makeService({ submissions: 1, changeRequests: 0 });

    await expect(
      service.sendAdminReviewAlert({ kind: 'submission', programId: 'prog-1', businessName: 'Golden Fork' }),
    ).resolves.toBeUndefined();
  });
});
