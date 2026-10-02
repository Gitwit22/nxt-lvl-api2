import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/env';
import type { NotificationsService } from '../notifications/notifications.service';
import {
  FormEmailDeliveryService,
  type FormEmailPayload,
} from './form-email-delivery.service';

const payload: FormEmailPayload = {
  eventId: 'evt_event-1',
  eventType: 'form.send',
  organizationId: 'org-1',
  clientId: 'client-1',
  clientName: 'Jordan Lee',
  recipientEmail: 'jordan@example.com',
  formId: 'form-1',
  formName: 'Master Intake',
  formUrl: 'https://clientflow.example/s/secure-token',
  expiresAt: '2026-09-27T23:59:59.999Z',
  sentByUserId: 'admin-1',
  personalMessage: 'Please complete this form.',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(overrides: Partial<Record<keyof Environment, unknown>> = {}) {
  const values: Partial<Record<keyof Environment, unknown>> = {
    N8N_FORM_EMAIL_ENABLED: 'true',
    N8N_FORM_EMAIL_WEBHOOK_URL: 'https://n8n.example/webhook/send-form',
    N8N_CLIENTFLOW_SECRET: 'shared-secret',
    N8N_FORM_EMAIL_BEARER_TOKEN: 'bearer-token',
    N8N_FORM_EMAIL_TIMEOUT_MS: 15_000,
    ...overrides,
  };
  const config = {
    get: jest.fn((key: keyof Environment) => values[key]),
  };
  const notifications = { sendFormLink: jest.fn().mockResolvedValue(undefined) };
  const service = new FormEmailDeliveryService(
    config as unknown as ConfigService<Environment, true>,
    notifications as unknown as NotificationsService,
  );
  return { service, config, notifications };
}

function successReceipt(overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    status: 'SENT',
    eventId: payload.eventId,
    clientId: payload.clientId,
    formId: payload.formId,
    recipientEmail: payload.recipientEmail,
    sentAt: '2026-09-20T18:00:00.000Z',
    ...overrides,
  };
}

describe('FormEmailDeliveryService final split', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses Resend only and never calls the legacy ClientFlow n8n chain', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { service, notifications } = setup();

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .resolves.toEqual({ provider: 'RESEND', sentAt: expect.any(Date) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(notifications.sendFormLink).toHaveBeenCalledWith(expect.objectContaining({
      to: payload.recipientEmail,
      secureLink: payload.formUrl,
      personalMessage: payload.personalMessage,
    }));
  });

  it('fails safely when Resend delivery is unavailable', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { service, notifications } = setup();
    notifications.sendFormLink.mockRejectedValueOnce(new Error('resend-down'));

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .rejects.toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
