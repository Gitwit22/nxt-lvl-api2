import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  // Email / notification-core
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_SEND_ENABLED: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  EMAIL_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  APP_URL: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;
