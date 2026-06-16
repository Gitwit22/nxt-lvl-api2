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
}
