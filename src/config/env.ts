import { z } from 'zod';

function databaseTarget(value: string): string | null {
  try {
    const url = new URL(value);
    return `${url.hostname.toLowerCase()}:${url.port || '5432'}${url.pathname}`;
  } catch {
    return null;
  }
}

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CLIENTFLOW_DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  CLIENTFLOW_R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  // Email / notification-core
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_SEND_ENABLED: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  EMAIL_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  APP_URL: z.string().optional(),
}).superRefine((config, context) => {
  const primaryTarget = databaseTarget(config.DATABASE_URL);
  const clientflowTarget = databaseTarget(config.CLIENTFLOW_DATABASE_URL);

  if (!primaryTarget) {
    context.addIssue({
      code: 'custom',
      path: ['DATABASE_URL'],
      message: 'DATABASE_URL must be a valid database URL.',
    });
  }
  if (!clientflowTarget) {
    context.addIssue({
      code: 'custom',
      path: ['CLIENTFLOW_DATABASE_URL'],
      message: 'CLIENTFLOW_DATABASE_URL must be a valid database URL.',
    });
  }
  if (primaryTarget && primaryTarget === clientflowTarget) {
    context.addIssue({
      code: 'custom',
      path: ['CLIENTFLOW_DATABASE_URL'],
      message: 'CLIENTFLOW_DATABASE_URL must target a different database than DATABASE_URL.',
    });
  }
});

export type Environment = z.infer<typeof environmentSchema>;
