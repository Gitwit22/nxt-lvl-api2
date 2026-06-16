import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().optional(),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('1d'),
  // Email / notification-core
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_SEND_ENABLED: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  EMAIL_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  APP_URL: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;
