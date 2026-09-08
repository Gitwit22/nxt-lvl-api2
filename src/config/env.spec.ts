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