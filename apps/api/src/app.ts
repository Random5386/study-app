// Builds the Express app: middleware first, then routes, then the error handler.
// It does NOT start listening (server.ts does that), so tests can import it directly.
// See docs/04-express-backend.md for how the middleware pipeline works.
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // correct client IPs and secure cookies if deployed behind a proxy later
  app.use(helmet()); // security headers (docs/08-web-security.md)
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
  app.use(express.json({ limit: '1mb' })); // parse JSON bodies, reject huge ones

  // ---- API routes ----
  app.use('/api/health', healthRouter);
  // Later phases add: /api/auth, /api/notes, /api/documents, /api/decks, /api/study
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
