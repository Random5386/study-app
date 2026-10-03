// HTTP endpoints for signing up and signing in: /api/auth/...
// The router is built by a function so tests can pass in relaxed rate limits.
// See docs/06-authentication-sessions.md and docs/07-mfa-totp.md.
import { Router } from 'express';
import {
  emailOnlySchema,
  loginSchema,
  mfaVerifySchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type LoginResponse,
  type SessionResponse,
} from '@studyapp/shared';
import { prisma } from '../../db/prisma.js';
import { audit } from '../../lib/audit.js';
import { HttpError } from '../../lib/httpError.js';
import { issueCsrfToken } from '../../middleware/csrf.js';
import type { RateLimiters } from '../../middleware/rateLimits.js';
import { currentUserId, requireAuth } from '../../middleware/requireAuth.js';
import { destroySession, regenerateSession, saveSession, SESSION_COOKIE } from '../../middleware/session.js';
import { validateBody } from '../../middleware/validate.js';
import { mfaService } from '../account/mfa.service.js';
import { authService, toPublicUser } from './auth.service.js';

const CHECK_INBOX = 'Check your inbox. If the details are right, an email is on its way.';

export function createAuthRouter(limits: RateLimiters) {
  const router = Router();

  // The React app calls this once on start-up, then sends the token as X-CSRF-Token.
  router.get('/csrf', (req, res) => {
    res.json({ csrfToken: req.session.csrfToken ?? issueCsrfToken(req) });
  });

  // Same answer whether or not the email exists, so nobody can test which emails have accounts.
  router.post('/register', limits.emailActions, validateBody(registerSchema), async (req, res) => {
    await authService.register(req.body, req);
    res.status(202).json({ message: CHECK_INBOX });
  });

  router.post('/verify-email', validateBody(verifyEmailSchema), async (req, res) => {
    await authService.verifyEmail(req.body.token, req);
    res.json({ message: 'Email confirmed. You can sign in now.' });
  });

  router.post(
    '/resend-verification',
    limits.emailActions,
    validateBody(emailOnlySchema),
    async (req, res) => {
      await authService.resendVerification(req.body.email);
      res.status(202).json({ message: CHECK_INBOX });
    },
  );

  router.post('/login', limits.login, validateBody(loginSchema), async (req, res) => {
    const user = await authService.login(req.body, req);

    await regenerateSession(req); // brand-new session id → stops session fixation
    req.session.userId = user.id;
    const mfaRequired = user.mfaEnabledAt !== null;
    req.session.mfaPending = mfaRequired; // requireAuth refuses everything until the code is checked
    const csrfToken = issueCsrfToken(req); // the old token died with the old session
    await saveSession(req);

    if (!mfaRequired) {
      await authService.recordLoginSession(user.id, req);
      await audit(user.id, 'LOGIN', req);
    }
    const body: LoginResponse = {
      mfaRequired,
      csrfToken,
      user: mfaRequired ? undefined : toPublicUser(user),
    };
    res.json(body);
  });

  router.post('/mfa/verify', limits.mfa, validateBody(mfaVerifySchema), async (req, res) => {
    const userId = req.session.userId;
    if (!userId || !req.session.mfaPending) throw new HttpError(400, 'No sign-in in progress. Start again.');

    const user = await authService.getUser(userId);
    const result = await mfaService.verifyCode(user, req.body.code);
    if (!result) {
      await audit(userId, 'MFA_FAILED', req);
      throw new HttpError(401, 'That code is not right. Try the newest code in your app.');
    }
    if (result === 'recovery') await audit(userId, 'RECOVERY_CODE_USED', req);

    await regenerateSession(req); // privileges just went up → new id again
    req.session.userId = userId;
    req.session.mfaPending = false;
    const csrfToken = issueCsrfToken(req);
    await saveSession(req);
    await authService.recordLoginSession(userId, req);
    await audit(userId, 'LOGIN', req);

    const body: LoginResponse = { mfaRequired: false, csrfToken, user: toPublicUser(user) };
    res.json(body);
  });

  router.post('/logout', async (req, res) => {
    const { userId } = req.session;
    const sid = req.sessionID;
    await destroySession(req);
    await authService.forgetLoginSession(sid);
    if (userId) await audit(userId, 'LOGOUT', req);
    res.clearCookie(SESSION_COOKIE);
    res.status(204).end();
  });

  // Who is signed in? Always 200 (user: null when signed out), so the React app can ask freely.
  router.get('/session', async (req, res) => {
    const { userId, mfaPending } = req.session;
    let body: SessionResponse = { user: null, mfaPending: Boolean(userId && mfaPending) };
    if (userId && !mfaPending) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      body = { user: user ? toPublicUser(user) : null, mfaPending: false };
    }
    res.json(body);
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json(toPublicUser(await authService.getUser(currentUserId(req))));
  });

  router.post('/forgot-password', limits.emailActions, validateBody(emailOnlySchema), async (req, res) => {
    await authService.forgotPassword(req.body.email, req);
    res.status(202).json({ message: CHECK_INBOX });
  });

  router.post('/reset-password', validateBody(resetPasswordSchema), async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password, req);
    res.json({ message: 'Password changed. Sign in with your new password.' });
  });

  return router;
}
