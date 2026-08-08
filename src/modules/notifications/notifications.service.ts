import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import {
  SendEmailUseCase,
  ResendEmailProvider,
  ConsoleEmailLogger,
  loadNotificationConfig,
} from '@nxtlvl/notification-core';
import type { PartitionRequest } from '../../common/interfaces/partition-request.interface';

@Injectable({ scope: Scope.REQUEST })
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly useCase: SendEmailUseCase | null = null;

  constructor(@Inject(REQUEST) private readonly request: PartitionRequest) {
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
        ? `Update approved ΓÇö ${options.businessName}`
        : `Update not approved ΓÇö ${options.businessName}`,
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
}
