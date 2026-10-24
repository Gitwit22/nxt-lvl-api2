import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  Scope,
  ServiceUnavailableException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
  SendEmailUseCase,
  ResendEmailProvider,
  ConsoleEmailLogger,
  loadNotificationConfig,
} from '@nxtlvl/notification-core';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';
import { PrismaService } from '../../prisma/prisma.service';

/** Parses ADMIN_NOTIFICATION_EMAILS ("a@x.com, b@y.com") into a clean recipient list. */
export function parseAdminRecipients(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable({ scope: Scope.REQUEST })
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly useCase: SendEmailUseCase | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: PartitionRequest,
    private readonly prisma: PrismaService,
  ) {
    try {
      const config = loadNotificationConfig();
      const provider = new ResendEmailProvider(config);
      const emailLogger = new ConsoleEmailLogger(config.logLevel);
      this.useCase = new SendEmailUseCase({ provider, config, logger: emailLogger });
      this.logger.log('Email notifications initialized.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Email notifications disabled: ${msg}`);
    }
  }

  async sendEditLink(options: {
    to: string;
    businessName: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.useCase) return;
    const partition = this.request.partition;
    const appUrl = process.env['APP_URL'] ?? partition.appUrl;
    const editUrl = `${appUrl}/edit?token=${options.token}`;
    await this.useCase.execute({
      to: options.to,
      subject: `Edit your listing ΓÇö ${options.businessName}`,
      html: `
        <p>Hi there,</p>
        <p>Here is your one-time edit link for <strong>${options.businessName}</strong>:</p>
        <p><a href="${editUrl}" style="color:#C45A8A">${editUrl}</a></p>
        <p>This link expires on ${options.expiresAt.toUTCString()}. Do not share it.</p>
        <p>ΓÇö ${partition.appName}</p>
      `,
      text: `Edit your listing: ${editUrl}\n\nExpires: ${options.expiresAt.toUTCString()}`,
    });
  }

  async sendUpdateRequestSubmitted(options: {
    to: string;
    businessName: string;
  }): Promise<void> {
    if (!this.useCase) return;
    const partition = this.request.partition;
    await this.useCase.execute({
      to: options.to,
      subject: `Update request received ΓÇö ${options.businessName}`,
      html: `
        <p>Hi there,</p>
        <p>We received your update request for <strong>${options.businessName}</strong>.</p>
        <p>Your changes are now pending admin review. We will email you once a decision is made.</p>
        <p>ΓÇö ${partition.appName}</p>
      `,
      text:
        `We received your update request for ${options.businessName}.\n` +
        'Your changes are pending admin review. We will email you once a decision is made.',
    });
  }

  async sendFormLink(options: {
    to: string;
    contactName: string;
    formName: string;
    programName: string;
    dueDate: string;
    secureLink: string;
    personalMessage?: string;
  }): Promise<void> {
    if (!this.useCase) throw new ServiceUnavailableException('Email notifications are not configured.');
    const partition = this.request.partition;
    const personalBlock = options.personalMessage
      ? `<p style="background:#f9f9f9;border-left:3px solid #C45A8A;padding:12px 16px;margin:16px 0;font-style:italic;">${options.personalMessage}</p>`
      : '';
    const textParts = [
      `Hi ${options.contactName},`,
      '',
      `You have a form to complete as part of the ${options.programName} program.`,
      ...(options.personalMessage ? ['', options.personalMessage] : []),
      '',
      `Form: ${options.formName}`,
      `Due: ${options.dueDate}`,
      '',
      `Complete your form here: ${options.secureLink}`,
      '',
      `— ${partition.appName}`,
    ];
    const result = await this.useCase.execute({
      to: options.to,
      subject: `Action required: ${options.formName}`,
      html: `
        <p>Hi ${options.contactName},</p>
        <p>You have been sent a form as part of the <strong>${options.programName}</strong> program.</p>
        ${personalBlock}
        <p>
          <strong>Form:</strong> ${options.formName}<br/>
          <strong>Due:</strong> ${options.dueDate}
        </p>
        <p style="margin:24px 0;">
          <a href="${options.secureLink}"
             style="background:#C45A8A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Complete your form
          </a>
        </p>
        <p style="color:#888;font-size:13px;">
          Or copy this link into your browser:<br/>
          <a href="${options.secureLink}" style="color:#C45A8A;">${options.secureLink}</a>
        </p>
        <p style="color:#aaa;font-size:12px;">
          If you did not expect this email, you can safely ignore it.
        </p>
        <p>— ${partition.appName}</p>
      `,
      text: textParts.join('\n'),
    });
    if (!result.success) {
      if ('skipped' in result) {
        throw new ServiceUnavailableException('Email delivery is disabled.');
      }
      this.logger.error(`Form email delivery failed: ${result.error.message}`);
      throw new BadGatewayException('The email provider rejected the form email.');
    }
  }

  async sendUpdateRequestReviewed(options: {
    to: string;
    businessName: string;
    status: 'approved' | 'rejected';
  }): Promise<void> {
    if (!this.useCase) return;
    const partition = this.request.partition;
    const approved = options.status === 'approved';
    await this.useCase.execute({
      to: options.to,
      subject: approved
        ? `Update approved — ${options.businessName}`
        : `Update not approved — ${options.businessName}`,
      html: approved
        ? `
          <p>Hi there,</p>
          <p>Your update request for <strong>${options.businessName}</strong> was approved and is now live.</p>
          <p>Thank you for keeping your listing current.</p>
          <p>ΓÇö ${partition.appName}</p>
        `
        : `
          <p>Hi there,</p>
          <p>Your update request for <strong>${options.businessName}</strong> was reviewed but not approved.</p>
          <p>You can request another edit link and submit updated changes at any time.</p>
          <p>ΓÇö ${partition.appName}</p>
        `,
      text: approved
        ? `Your update request for ${options.businessName} was approved and is now live.`
        : `Your update request for ${options.businessName} was reviewed but not approved. You can submit updated changes any time.`,
    });
  }

  async sendInviteEmail(options: {
    to: string;
    firstName: string;
    orgName: string;
    role: string;
    inviteUrl: string;
  }): Promise<void> {
    if (!this.useCase) return;
    const partition = this.request.partition;
    await this.useCase.execute({
      to: options.to,
      subject: `You've been invited to join ${options.orgName} on ${partition.appName}`,
      html: `
        <p>Hi ${options.firstName},</p>
        <p>You have been invited to join <strong>${options.orgName}</strong> on ${partition.appName} as a <strong>${options.role}</strong>.</p>
        <p>Click the button below to set up your account. This link expires in 72 hours.</p>
        <p style="margin:24px 0;">
          <a href="${options.inviteUrl}"
             style="background:#C45A8A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
            Set up your account
          </a>
        </p>
        <p style="color:#888;font-size:13px;">
          Or copy this link into your browser:<br/>
          <a href="${options.inviteUrl}" style="color:#C45A8A;">${options.inviteUrl}</a>
        </p>
        <p style="color:#aaa;font-size:12px;">
          If you did not expect this invitation, you can safely ignore this email.
        </p>
        <p>— ${partition.appName}</p>
      `,
      text: [
        `Hi ${options.firstName},`,
        '',
        `You have been invited to join ${options.orgName} on ${partition.appName} as a ${options.role}.`,
        '',
        `Set up your account here: ${options.inviteUrl}`,
        '',
        'This link expires in 72 hours.',
        '',
        `— ${partition.appName}`,
      ].join('\n'),
    });
  }

  /**
   * Emails the admins in ADMIN_NOTIFICATION_EMAILS that a new listing or listing
   * update is waiting for review. Never throws: a failed alert must not fail the
   * public submission that triggered it.
   */
  async sendAdminReviewAlert(options: {
    kind: 'submission' | 'change_request';
    programId: string;
    businessName: string;
  }): Promise<void> {
    const recipients = parseAdminRecipients(process.env['ADMIN_NOTIFICATION_EMAILS']);
    if (!this.useCase || recipients.length === 0) return;

    try {
      const [pendingSubmissions, pendingChangeRequests] = await Promise.all([
        this.prisma.businessSubmission.count({
          where: { programId: options.programId, status: 'pending_review' },
        }),
        this.prisma.businessChangeRequest.count({
          where: { status: 'pending_review', business: { programId: options.programId } },
        }),
      ]);
      const totalPending = pendingSubmissions + pendingChangeRequests;

      const partition = this.request.partition;
      const appUrl = (process.env['APP_URL'] ?? partition.appUrl).replace(/\/$/, '');
      const adminUrl = `${appUrl}/admin`;
      const what = options.kind === 'submission' ? 'New listing submitted' : 'Listing update requested';
      const name = escapeHtml(options.businessName);

      const result = await this.useCase.execute({
        to: recipients,
        subject: `${what}: ${options.businessName} (${totalPending} awaiting review)`,
        html: `
          <p><strong>${what}:</strong> ${name}</p>
          <p>
            You have <strong>${totalPending}</strong> item${totalPending === 1 ? '' : 's'} awaiting review:
            ${pendingSubmissions} new listing${pendingSubmissions === 1 ? '' : 's'},
            ${pendingChangeRequests} listing update${pendingChangeRequests === 1 ? '' : 's'}.
          </p>
          <p style="margin:24px 0;">
            <a href="${adminUrl}"
               style="background:#7A16D6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
              Review in admin
            </a>
          </p>
          <p>— ${escapeHtml(partition.appName)}</p>
        `,
        text: [
          `${what}: ${options.businessName}`,
          '',
          `Awaiting review: ${totalPending} (${pendingSubmissions} new listings, ${pendingChangeRequests} listing updates)`,
          '',
          `Review in admin: ${adminUrl}`,
        ].join('\n'),
      });
      if (!result.success && !('skipped' in result)) {
        this.logger.error(`Admin review alert delivery failed: ${result.error.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Admin review alert failed: ${msg}`);
    }
  }
}
