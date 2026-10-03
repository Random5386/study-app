// GET /api/health: is the API running, and can it reach the database?
// Useful for you while developing, and for hosts/monitors if you deploy later.
import { Router } from 'express';
import type { HealthResponse } from '@studyapp/shared';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let database: HealthResponse['database'] = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`; // the cheapest possible query
  } catch (err) {
    logger.warn({ err }, 'Health check: database unreachable');
    database = 'down';
  }

  const body: HealthResponse = {
    ok: database === 'up',
    app: env.APP_NAME,
    database,
    time: new Date().toISOString(),
  };
  res.status(body.ok ? 200 : 503).json(body); // 503 Service Unavailable when the DB is down
});
