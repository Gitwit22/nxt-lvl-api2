import { environmentSchema } from './env';

const baseEnvironment = {
  NODE_ENV: 'production',
  JWT_SECRET: 'test-secret-that-is-at-least-thirty-two-characters',
};

describe('environmentSchema database isolation', () => {
  it('accepts distinct primary and ClientFlow database targets', () => {
    expect(() => environmentSchema.parse({
      ...baseEnvironment,
      DATABASE_URL: 'postgresql://user:secret@primary.example/neondb',
      CLIENTFLOW_DATABASE_URL: 'postgresql://user:secret@clientflow.example/neondb',
    })).not.toThrow();
  });

  it('rejects the same target even when credentials differ', () => {
    expect(() => environmentSchema.parse({
      ...baseEnvironment,
      DATABASE_URL: 'postgresql://primary:one@same.example/neondb',
      CLIENTFLOW_DATABASE_URL: 'postgresql://clientflow:two@same.example/neondb',
    })).toThrow('CLIENTFLOW_DATABASE_URL must target a different database than DATABASE_URL.');
  });
});

describe('environmentSchema n8n form email settings', () => {
  const databases = {
    DATABASE_URL: 'postgresql://user:secret@primary.example/neondb',
    CLIENTFLOW_DATABASE_URL: 'postgresql://user:secret@clientflow.example/neondb',
  };

  it('defaults the integration to disabled with a 15 second timeout', () => {
    const environment = environmentSchema.parse({ ...baseEnvironment, ...databases });

    expect(environment.N8N_FORM_EMAIL_ENABLED).toBe('false');
    expect(environment.N8N_FORM_EMAIL_TIMEOUT_MS).toBe(15_000);
  });

  it('accepts an enabled HTTPS webhook configuration', () => {
    const environment = environmentSchema.parse({
      ...baseEnvironment,
      ...databases,
      N8N_FORM_EMAIL_ENABLED: 'true',
      N8N_FORM_EMAIL_WEBHOOK_URL: 'https://n8n.example/webhook/send-form',
      N8N_CLIENTFLOW_SECRET: 'shared-secret',
      N8N_FORM_EMAIL_BEARER_TOKEN: 'bearer-token',
      N8N_FORM_EMAIL_TIMEOUT_MS: '5000',
    });

    expect(environment.N8N_FORM_EMAIL_TIMEOUT_MS).toBe(5000);
  });

  it('requires both webhook credentials when enabled', () => {
    expect(() => environmentSchema.parse({
      ...baseEnvironment,
      ...databases,
      N8N_FORM_EMAIL_ENABLED: 'true',
      N8N_FORM_EMAIL_WEBHOOK_URL: 'https://n8n.example/webhook/send-form',
    })).toThrow('N8N_CLIENTFLOW_SECRET is required when N8N_FORM_EMAIL_ENABLED is true.');
  });

  it('rejects an insecure production webhook URL', () => {
    expect(() => environmentSchema.parse({
      ...baseEnvironment,
      ...databases,
      N8N_FORM_EMAIL_WEBHOOK_URL: 'http://n8n.example/webhook/send-form',
    })).toThrow('N8N_FORM_EMAIL_WEBHOOK_URL must use HTTPS in production.');
  });
});