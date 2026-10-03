// Reads every setting once, checks it with Zod, and exports a typed `env` object.
// Every other file imports `env` from here instead of touching process.env.
// See docs/03-project-setup.md.
import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

// Load the .env file from the repo root. Values already set (e.g. by tests or CI) win.
config({ path: path.resolve(import.meta.dirname, '../../../../.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().min(1).default('StudyApp'),
  APP_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000), // env vars are strings; coerce turns "3000" into 3000
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'must be at least 32 characters (run `npm run setup`)'),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, 'must be 64 hex characters (run `npm run setup`)'),
  GEMINI_API_KEY: z.string().min(1, 'paste your free key from https://aistudio.google.com/apikey'),
  GEMINI_MODEL: z.string().min(1),
  GEMINI_FALLBACK_MODEL: z.string().min(1),
  AI_DAILY_QUOTA: z.coerce.number().int().positive().default(20),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a clear message now beats a confusing crash later.
  console.error('\n❌ Invalid or missing settings in .env:\n' + z.prettifyError(parsed.error) + '\n');
  process.exit(1);
}

export const env: Env = parsed.data;
