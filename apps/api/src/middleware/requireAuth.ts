// The login gate for protected routes. See docs/04-express-backend.md.
import type { Request, RequestHandler } from 'express';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

const FIVE_MINUTES = 5 * 60 * 1000;

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) throw new HttpError(401, 'Please log in');
  if (req.session.mfaPending) throw new HttpError(403, 'Finish two-factor sign-in first');

  // Keep "last active" on the Active sessions page roughly current (at most one write per 5 minutes).
  const now = Date.now();
  if (!req.session.lastSeenAt || now - req.session.lastSeenAt > FIVE_MINUTES) {
    req.session.lastSeenAt = now;
    prisma.loginSession
      .updateMany({ where: { sid: req.sessionID }, data: { lastSeenAt: new Date(now) } })
      .catch((err: unknown) => logger.warn({ err }, 'Could not update lastSeenAt'));
  }
  next();
};

/** The signed-in user's id. Only call it on routes behind requireAuth. */
export function currentUserId(req: Request): string {
  const id = req.session.userId;
  if (!id || req.session.mfaPending) throw new HttpError(401, 'Please log in');
  return id;
}
