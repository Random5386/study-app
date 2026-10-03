// Structured logging with pino. Secrets are redacted before anything is written.
// See docs/08-web-security.md ("Safe logging").
import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.apiKey',
      '*.code',
    ],
    censor: '[redacted]',
  },
  // Pretty, coloured logs while developing; plain JSON lines in production.
  transport:
    env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
