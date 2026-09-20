import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/env';
import { NotificationsService } from '../notifications/notifications.service';

export type FormEmailProvider = 'N8N_GMAIL' | 'RESEND';
export type FormEmailErrorCode =
  | 'N8N_UNAUTHORIZED'
  | 'N8N_INVALID_REQUEST'
  | 'N8N_TIMEOUT'
  | 'N8N_UNAVAILABLE'
  | 'EMAIL_DELIVERY_FAILED'
  | 'INVALID_PROVIDER_RESPONSE';

export interface FormEmailPayload {
  eventId: string;
  eventType: 'form.send';
  organizationId: string;
  clientId: string;
  clientName: string;
  recipientEmail: string;
  formId: string;
  formName: string;
  formUrl: string;
  expiresAt: string | null;
  sentByUserId: string;
  personalMessage?: string;
}

export interface FormEmailDeliveryOptions {
  payload: FormEmailPayload;
  programName: string;
  dueDate: string;
}

export interface FormEmailDeliveryReceipt {
  provider: FormEmailProvider;
  sentAt: Date;
}

export class FormEmailDeliveryError extends Error {
  constructor(public readonly code: FormEmailErrorCode) {
    super('We could not confirm delivery of this form email. The form was not marked as sent. Please try again or contact support.');
    this.name = 'FormEmailDeliveryError';
  }
}

@Injectable()
export class FormEmailDeliveryService {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly notifications: NotificationsService,
  ) {}

  get provider(): FormEmailProvider {
    return this.config.get('N8N_FORM_EMAIL_ENABLED', { infer: true }) === 'true'
      ? 'N8N_GMAIL'
      : 'RESEND';
  }

  async send(options: FormEmailDeliveryOptions): Promise<FormEmailDeliveryReceipt> {
    if (this.provider === 'RESEND') {
      return this.sendWithResend(options);
    }
    return this.sendWithN8n(options.payload);
  }

  private async sendWithResend(
    { payload, programName, dueDate }: FormEmailDeliveryOptions,
  ): Promise<FormEmailDeliveryReceipt> {
    try {
      await this.notifications.sendFormLink({
        to: payload.recipientEmail,
        contactName: payload.clientName,
        formName: payload.formName,
        programName,
        dueDate,
        secureLink: payload.formUrl,
        personalMessage: payload.personalMessage,
      });
      return { provider: 'RESEND', sentAt: new Date() };
    } catch {
      throw new FormEmailDeliveryError('EMAIL_DELIVERY_FAILED');
    }
  }

  private async sendWithN8n(payload: FormEmailPayload): Promise<FormEmailDeliveryReceipt> {
    const webhookUrl = this.config.get('N8N_FORM_EMAIL_WEBHOOK_URL', { infer: true });
    const clientflowSecret = this.config.get('N8N_CLIENTFLOW_SECRET', { infer: true });
    const bearerToken = this.config.get('N8N_FORM_EMAIL_BEARER_TOKEN', { infer: true });
    const timeoutMs = this.config.get('N8N_FORM_EMAIL_TIMEOUT_MS', { infer: true });
    if (!webhookUrl || !clientflowSecret || !bearerToken) {
      throw new FormEmailDeliveryError('EMAIL_DELIVERY_FAILED');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clientflow-secret': clientflowSecret,
          Authorization: `Bearer ${bearerToken}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FormEmailDeliveryError('N8N_TIMEOUT');
      }
      throw new FormEmailDeliveryError('N8N_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 400) throw new FormEmailDeliveryError('N8N_INVALID_REQUEST');
      if (response.status === 401 || response.status === 403) {
        throw new FormEmailDeliveryError('N8N_UNAUTHORIZED');
      }
      if (response.status >= 500) throw new FormEmailDeliveryError('N8N_UNAVAILABLE');
      throw new FormEmailDeliveryError('EMAIL_DELIVERY_FAILED');
    }

    let receipt: unknown;
    try {
      receipt = await response.json();
    } catch {
      throw new FormEmailDeliveryError('INVALID_PROVIDER_RESPONSE');
    }
    if (!this.isValidReceipt(receipt, payload)) {
      throw new FormEmailDeliveryError('INVALID_PROVIDER_RESPONSE');
    }

    return { provider: 'N8N_GMAIL', sentAt: new Date(receipt.sentAt) };
  }

  private isValidReceipt(
    value: unknown,
    payload: FormEmailPayload,
  ): value is { sentAt: string } {
    if (!value || typeof value !== 'object') return false;
    const receipt = value as Record<string, unknown>;
    if (
      receipt.success !== true
      || receipt.status !== 'SENT'
      || receipt.eventId !== payload.eventId
      || typeof receipt.sentAt !== 'string'
      || Number.isNaN(Date.parse(receipt.sentAt))
    ) return false;
    if (receipt.clientId !== undefined && receipt.clientId !== payload.clientId) return false;
    if (receipt.formId !== undefined && receipt.formId !== payload.formId) return false;
    if (
      receipt.recipientEmail !== undefined
      && receipt.recipientEmail !== payload.recipientEmail
    ) return false;
    return true;
  }
}
