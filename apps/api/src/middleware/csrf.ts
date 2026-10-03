// CSRF protection with a secret token per session (the "synchronizer token" pattern).
// Another website can make your browser SEND a request, but it can't READ this token,
// so it can't forge the X-CSRF-Token header. See docs/08-web-security.md.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Create (or replace) this session's CSRF token and return it. */
export function issueCsrfToken(req: Request): string {
  req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next(); // reads don't change data
  const expected = req.session.csrfToken;
  const sent = req.get('x-csrf-token');
  if (!expected || !sent || !safeEqual(expected, sent)) {
    throw new HttpError(403, 'Invalid or missing CSRF token. Refresh the page and try again.');
  }
  next();
};

// Compare in constant time so response timing doesn't leak how many characters matched.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
