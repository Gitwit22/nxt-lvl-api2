import { Injectable, Logger } from '@nestjs/common';
import {
  SendEmailUseCase,
  ResendEmailProvider,
  ConsoleEmailLogger,
  loadNotificationConfig,
} from '@nxtlvl/notification-core';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly useCase: SendEmailUseCase | null = null;

  constructor() {
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
    const appUrl = process.env['APP_URL'] ?? 'https://fbapp.pages.dev';
    const editUrl = `${appUrl}/edit?token=${options.token}`;
    await this.useCase.execute({
      to: options.to,
      subject: `Edit your listing — ${options.businessName}`,
      html: `
        <p>Hi there,</p>
        <p>Here is your one-time edit link for <strong>${options.businessName}</strong>:</p>
        <p><a href="${editUrl}" style="color:#C45A8A">${editUrl}</a></p>
        <p>This link expires on ${options.expiresAt.toUTCString()}. Do not share it.</p>
        <p>— FBAppInc Directory</p>
      `,
      text: `Edit your listing: ${editUrl}\n\nExpires: ${options.expiresAt.toUTCString()}`,
    });
  }

  async sendUpdateRequestSubmitted(options: {
    to: string;
    businessName: string;
  }): Promise<void> {
    if (!this.useCase) return;
    await this.useCase.execute({
      to: options.to,
      subject: `Update request received — ${options.businessName}`,
      html: `
        <p>Hi there,</p>
        <p>We received your update request for <strong>${options.businessName}</strong>.</p>
        <p>Your changes are now pending admin review. We will email you once a decision is made.</p>
        <p>— FBAppInc Directory</p>
      `,
      text:
        `We received your update request for ${options.businessName}.\n` +
        'Your changes are pending admin review. We will email you once a decision is made.',
    });
  }

  async sendUpdateRequestReviewed(options: {
    to: string;
    businessName: string;
    status: 'approved' | 'rejected';
  }): Promise<void> {
    if (!this.useCase) return;
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
          <p>— FBAppInc Directory</p>
        `
        : `
          <p>Hi there,</p>
          <p>Your update request for <strong>${options.businessName}</strong> was reviewed but not approved.</p>
          <p>You can request another edit link and submit updated changes at any time.</p>
          <p>— FBAppInc Directory</p>
        `,
      text: approved
        ? `Your update request for ${options.businessName} was approved and is now live.`
        : `Your update request for ${options.businessName} was reviewed but not approved. You can submit updated changes any time.`,
    });
  }
}
