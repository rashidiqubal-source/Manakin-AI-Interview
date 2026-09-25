import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ override: true });

// Support alternate environment variable names that may come from tooling or user config
if (!process.env.OPENAI_API_KEY && process.env['.env.OPENAI_API_KEY']) {
  process.env.OPENAI_API_KEY = process.env['.env.OPENAI_API_KEY'];
}
if (!process.env.MAILERO_USERNAME && process.env.SMTP_USERNAME) {
  process.env.MAILERO_USERNAME = process.env.SMTP_USERNAME;
}
if (!process.env.MAILERO_PASSWORD && process.env.SMTP_PASSWORD) {
  process.env.MAILERO_PASSWORD = process.env.SMTP_PASSWORD;
}
if (!process.env.MAILERO_SENDING_KEY && process.env.SENDING_KEY) {
  process.env.MAILERO_SENDING_KEY = process.env.SENDING_KEY;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url('Invalid Database URL format'),
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API Key is required'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  FRONTEND_URL: z.string().default('http://localhost:3001'),
  SESSION_COOKIE_NAME: z.string().default('ai_interview_session'),
  SESSION_SECRET: z.string().default('default-super-secure-session-signing-secret-change-in-production-min-32-chars'),
  SESSION_EXPIRES_DAYS: z.coerce.number().default(7),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.boolean().optional(),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().default(15),
  AUTH_RATE_LIMIT_MAX_SIGNIN: z.coerce.number().default(10),
  AUTH_RATE_LIMIT_MAX_SIGNUP: z.coerce.number().default(5),
  AUTH_RATE_LIMIT_MAX_FORGOT_PW: z.coerce.number().default(5),
  MAILERO_HOST: z.string().default('smtp.mailersend.net'),
  MAILERO_PORT: z.string().default('587'),
  MAILERO_USERNAME: z.string().optional(),
  MAILERO_PASSWORD: z.string().optional(),
  MAILERO_SENDING_KEY: z.string().optional(),
  MAILERO_FROM: z.string()
    .default('AI Interview Platform <careers@example.com>')
    .transform((val) => val.replace(/\\"/g, '"').trim()),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

