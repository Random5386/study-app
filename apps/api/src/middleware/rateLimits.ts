// Slow down password guessing and email spam. See docs/08-web-security.md.
// The limiters are built by a function (not module-level constants) so each app
// instance gets its own counters: tests can use relaxed limits, and one test can
// check that the real limits work.
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

export type RateLimiters = {
  login: RequestHandler;
  mfa: RequestHandler;
  emailActions: RequestHandler;
  passwordConfirm: RequestHandler;
};

export type RateLimitMode = 'normal' | 'relaxed';

const ONE_MINUTE = 60_000;
const ip = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

export function createRateLimiters(mode: RateLimitMode = 'normal'): RateLimiters {
  const scale = mode === 'relaxed' ? 1000 : 1;
  const make = (windowMs: number, limit: number, error: string, key: (req: Request) => string) =>
    rateLimit({
      windowMs,
      limit: limit * scale,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: key,
      message: { error },
    });

  return {
    // Per IP + email: one attacker can't lock out everyone, and one account can't be hammered.
    login: make(ONE_MINUTE, 10, 'Too many sign-in attempts. Try again in a minute.', (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return `${ip(req)}:${email}`;
    }),
    // Per signed-in session: a 6-digit code has only a million options.
    mfa: make(ONE_MINUTE, 5, 'Too many codes. Try again in a minute.', (req) => req.sessionID),
    // Register, resend verification, forgot password: stop email spam from one IP.
    emailActions: make(15 * ONE_MINUTE, 10, 'Too many requests. Try again in a few minutes.', ip),
    // Security settings that ask for your password again.
    passwordConfirm: make(
      ONE_MINUTE,
      10,
      'Too many attempts. Try again in a minute.',
      (req) => req.sessionID,
    ),
  };
}
