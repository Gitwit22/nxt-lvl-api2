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

describe('FormEmailDeliveryService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the secure form payload with both auth headers and accepts a matching SENT receipt', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse(successReceipt()),
    );
    const { service } = setup();

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .resolves.toEqual({
        provider: 'N8N_GMAIL',
        sentAt: new Date('2026-09-20T18:00:00.000Z'),
      });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example/webhook/send-form',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-clientflow-secret': 'shared-secret',
          Authorization: 'Bearer bearer-token',
        },
        body: JSON.stringify(payload),
      }),
    );
  });

  it('uses Resend without calling n8n when the feature is disabled', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { service, notifications } = setup({ N8N_FORM_EMAIL_ENABLED: 'false' });

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .resolves.toEqual({ provider: 'RESEND', sentAt: expect.any(Date) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(notifications.sendFormLink).toHaveBeenCalledWith(expect.objectContaining({
      to: payload.recipientEmail,
      secureLink: payload.formUrl,
      personalMessage: payload.personalMessage,
    }));
  });

  it('fails configuration safely before calling n8n', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const { service } = setup({ N8N_CLIENTFLOW_SECRET: undefined });

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .rejects.toMatchObject({ code: 'EMAIL_DELIVERY_FAILED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'N8N_INVALID_REQUEST'],
    [401, 'N8N_UNAUTHORIZED'],
    [500, 'N8N_UNAVAILABLE'],
  ])('maps HTTP %s to %s', async (status, code) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}, status));
    const { service } = setup();

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .rejects.toMatchObject({ code });
  });

  it.each([
    successReceipt({ success: false }),
    successReceipt({ status: 'FAILED' }),
    successReceipt({ eventId: 'evt-other' }),
    successReceipt({ clientId: 'client-other' }),
    successReceipt({ sentAt: 'not-a-date' }),
  ])('rejects an invalid provider receipt', async (receipt) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse(receipt));
    const { service } = setup();

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
  });

  it('rejects malformed JSON as an invalid provider response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('not-json', { status: 200 }));
    const { service } = setup();

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESPONSE' });
  });

  it('maps network failures without retrying', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    const { service } = setup();

    await expect(service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' }))
      .rejects.toMatchObject({ code: 'N8N_UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a provider request at the configured timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    }));
    const { service } = setup({ N8N_FORM_EMAIL_TIMEOUT_MS: 25 });

    const delivery = service.send({ payload, programName: 'Accelerator', dueDate: '9/27/2026' });
    const rejection = expect(delivery).rejects.toMatchObject({ code: 'N8N_TIMEOUT' });
    await jest.advanceTimersByTimeAsync(25);
    await rejection;
    jest.useRealTimers();
  });
});
