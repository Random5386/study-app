// Builds the Express app: middleware first, then routes, then the error handler.
// It does NOT start listening (server.ts does that), so tests can import it directly.
// See docs/04-express-backend.md for how the middleware pipeline works.
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { csrfProtection } from './middleware/csrf.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { createRateLimiters, type RateLimitMode } from './middleware/rateLimits.js';
import { requireAuth } from './middleware/requireAuth.js';
import { sessionMiddleware } from './middleware/session.js';
import { createAccountRouter } from './modules/account/account.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { subjectsRouter } from './modules/subjects/subjects.routes.js';

export type AppOptions = {
  /** 'relaxed' multiplies every rate limit by 1000. Only tests use it. */
  rateLimits?: RateLimitMode;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  const limits = createRateLimiters(options.rateLimits);

  app.set('trust proxy', 1); // correct client IPs and secure cookies if deployed behind a proxy later
  app.use(helmet()); // security headers (docs/08-web-security.md)
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(express.json({ limit: '1mb' })); // parse JSON bodies, reject huge ones

  // ---- API routes ----
  app.use('/api/health', healthRouter); // no session needed
  app.use('/api', sessionMiddleware); // loads req.session from PostgreSQL
  app.use('/api', csrfProtection); // blocks forged POST/PATCH/DELETE requests
  app.use('/api/auth', createAuthRouter(limits)); // public: register, login, ...
  app.use('/api/account', requireAuth, createAccountRouter(limits)); // signed-in users only
  app.use('/api/subjects', requireAuth, subjectsRouter);
  app.use('/api/documents', requireAuth, documentsRouter);
  // Later phases add: /api/notes, /api/decks, /api/study
  app.use('/api', apiNotFound); // unknown /api/... paths → JSON 404

  // ---- The React app (only after `npm run build`; in development Vite serves it) ----
  const webDist = path.resolve(import.meta.dirname, '../../web/dist');
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html')); // React Router handles /notes, /decks, ...
    });
  }

  app.use(errorHandler); // must be last
  return app;
}
