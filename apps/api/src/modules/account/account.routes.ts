// Settings for the signed-in user: /api/account/... (profile, security, your data)
// Every route here sits behind requireAuth (see app.ts).
import { Router } from 'express';
import { z } from 'zod';
import {
  changePasswordSchema,
  deleteAccountSchema,
  mfaDisableSchema,
  mfaVerifySchema,
  passwordConfirmSchema,
  updateProfileSchema,
  type RecoveryCodesResponse,
} from '@studyapp/shared';
import { audit } from '../../lib/audit.js';
import { HttpError } from '../../lib/httpError.js';
import type { RateLimiters } from '../../middleware/rateLimits.js';
import { currentUserId } from '../../middleware/requireAuth.js';
import { SESSION_COOKIE, destroySession } from '../../middleware/session.js';
import { validateBody } from '../../middleware/validate.js';
import { authService, toPublicUser } from '../auth/auth.service.js';
import { emails } from '../auth/emails.js';
import { accountService, confirmPassword } from './account.service.js';
import { mfaService } from './mfa.service.js';

const idParams = z.object({ id: z.uuid() });

export function createAccountRouter(limits: RateLimiters) {
  const router = Router();
  const me = (req: Parameters<typeof currentUserId>[0]) => authService.getUser(currentUserId(req));

  // ---- Profile and preferences ----
  router.patch('/profile', validateBody(updateProfileSchema), async (req, res) => {
    res.json(toPublicUser(await accountService.updateProfile(currentUserId(req), req.body)));
  });

  // ---- Your data (POPIA: you can take a copy, or delete everything) ----
  // POST, not GET: it needs your password, so a stolen session cookie alone can't download everything.
  router.post('/export', limits.passwordConfirm, validateBody(passwordConfirmSchema), async (req, res) => {
    const user = await me(req);
    await confirmPassword(user, req.body.password);
    const data = await accountService.exportData(user.id);
    const day = new Date().toISOString().slice(0, 10);
    res.attachment(`studyapp-export-${day}.json`).json(data);
  });

  router.delete('/', limits.passwordConfirm, validateBody(deleteAccountSchema), async (req, res) => {
    await accountService.deleteAccount(await me(req), req.body);
    await destroySession(req);
    res.clearCookie(SESSION_COOKIE).json({ message: 'Your account and everything in it has been deleted.' });
  });

  // ---- Password ----
  router.post('/password', limits.passwordConfirm, validateBody(changePasswordSchema), async (req, res) => {
    await accountService.changePassword(await me(req), req.body, req);
    res.json({ message: 'Password changed. Your other devices were signed out.' });
  });

  // ---- Two-factor sign-in ----
  router.get('/mfa', async (req, res) => {
    const user = await me(req);
    res.json({
      enabled: user.mfaEnabledAt !== null,
      recoveryCodesLeft: user.mfaEnabledAt ? await mfaService.remainingRecoveryCodes(user.id) : 0,
    });
  });

  router.post('/mfa/setup', limits.passwordConfirm, validateBody(passwordConfirmSchema), async (req, res) => {
    const user = await me(req);
    await confirmPassword(user, req.body.password);
    res.json(await mfaService.startSetup(user));
  });

  router.post('/mfa/confirm', limits.mfa, validateBody(mfaVerifySchema), async (req, res) => {
    const user = await me(req);
    const recoveryCodes = await mfaService.confirmSetup(user, req.body.code);
    await audit(user.id, 'MFA_ENABLED', req);
    await emails.mfaChanged(user.email, user.displayName, true);
    const body: RecoveryCodesResponse = { recoveryCodes }; // shown ONCE; only hashes are kept
    res.json(body);
  });

  router.post('/mfa/disable', limits.passwordConfirm, validateBody(mfaDisableSchema), async (req, res) => {
    const user = await me(req);
    if (!user.mfaEnabledAt) throw new HttpError(400, 'Two-factor sign-in is already off');
    await confirmPassword(user, req.body.password);
    if (!(await mfaService.verifyCode(user, req.body.code))) {
      await audit(user.id, 'MFA_FAILED', req);
      throw new HttpError(401, 'That code is not right');
    }
    await mfaService.disable(user.id);
    await audit(user.id, 'MFA_DISABLED', req);
    await emails.mfaChanged(user.email, user.displayName, false);
    res.json({ message: 'Two-factor sign-in is off.' });
  });

  router.post(
    '/mfa/recovery-codes',
    limits.passwordConfirm,
    validateBody(passwordConfirmSchema),
    async (req, res) => {
      const user = await me(req);
      await confirmPassword(user, req.body.password);
      const body: RecoveryCodesResponse = { recoveryCodes: await mfaService.regenerateRecoveryCodes(user) };
      res.json(body);
    },
  );

  // ---- Active sessions ----
  router.get('/sessions', async (req, res) => {
    res.json(await accountService.listSessions(currentUserId(req), req.sessionID));
  });

  router.post('/sessions/revoke-others', async (req, res) => {
    const count = await accountService.revokeOtherSessions(currentUserId(req), req);
    res.json({ revoked: count });
  });

  router.delete('/sessions/:id', async (req, res) => {
    const { id } = idParams.parse(req.params);
    await accountService.revokeSession(currentUserId(req), id, req.sessionID, req);
    res.status(204).end();
  });

  // ---- Security history ----
  router.get('/security-history', async (req, res) => {
    res.json(await accountService.securityHistory(currentUserId(req)));
  });

  return router;
}
