// Security settings for a signed-in user: password, active sessions, security history.
import type { Request } from 'express';
import type {
  ActiveSession,
  AuditEntry,
  ChangePasswordInput,
  DeleteAccountInput,
  UpdateProfileInput,
} from '@studyapp/shared';
import { prisma } from '../../db/prisma.js';
import type { User } from '../../generated/prisma/client.js';
import { audit } from '../../lib/audit.js';
import { HttpError } from '../../lib/httpError.js';
import { hashPassword, verifyPassword } from '../../lib/passwords.js';
import { assertPasswordNotBreached, signOutEverywhere } from '../auth/auth.service.js';
import { emails } from '../auth/emails.js';
import { mfaService } from './mfa.service.js';

/** Security changes need fresh proof: the current password. */
export async function confirmPassword(user: User, password: string) {
  if (!(await verifyPassword(user.passwordHash, password))) {
    throw new HttpError(401, 'Your password is incorrect');
  }
}

export const accountService = {
  async updateProfile(userId: string, input: UpdateProfileInput) {
    return prisma.user.update({ where: { id: userId }, data: input });
  },

  /**
   * Everything we store about you, as JSON (POPIA section 23: access to personal information).
   * Secrets (password hash, MFA secret, recovery codes) stay out: they are useless to you and
   * dangerous in a downloads folder. Uploaded files are listed, not embedded; download them one by one.
   */
  async exportData(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        mfaEnabledAt: true,
        createdAt: true,
        subjects: { select: { name: true, colour: true, createdAt: true }, orderBy: { position: 'asc' } },
        documents: {
          orderBy: { createdAt: 'asc' },
          select: {
            title: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            status: true,
            pageCount: true,
            wordCount: true,
            createdAt: true,
            subject: { select: { name: true } },
            tags: { select: { tag: { select: { name: true } } } },
            summaries: {
              select: { style: true, points: true, keyTerms: true, model: true, createdAt: true },
            },
          },
        },
        auditLogs: {
          select: { event: true, ipAddress: true, userAgent: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return {
      exportedAt: new Date().toISOString(),
      ...user,
      documents: user.documents.map(({ subject, tags, ...d }) => ({
        ...d,
        subject: subject?.name ?? null,
        tags: tags.map((t) => t.tag.name),
      })),
    };
  },

  /** Deletes the user row; the database cascades to everything they own. There is no undo. */
  async deleteAccount(user: User, input: DeleteAccountInput) {
    await confirmPassword(user, input.password);
    if (user.mfaEnabledAt) {
      if (!input.code) throw new HttpError(400, 'Enter a code from your authenticator app');
      if (!(await mfaService.verifyCode(user, input.code))) {
        await audit(user.id, 'MFA_FAILED');
        throw new HttpError(401, 'That code is not right');
      }
    }
    await signOutEverywhere(user.id); // removes every session row, including this one
    await prisma.user.delete({ where: { id: user.id } });
    await emails.accountDeleted(user.email, user.displayName);
  },

  async changePassword(user: User, input: ChangePasswordInput, req: Request) {
    await confirmPassword(user, input.currentPassword);
    if (input.currentPassword === input.newPassword) {
      throw new HttpError(400, 'Choose a password different from your current one');
    }
    await assertPasswordNotBreached(input.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    await signOutEverywhere(user.id, req.sessionID); // other devices must sign in again
    await audit(user.id, 'PASSWORD_CHANGED', req);
    await emails.passwordChanged(user.email, user.displayName);
  },

  /** Signed-in devices, newest first. Rows whose session has expired are tidied away. */
  async listSessions(userId: string, currentSid: string): Promise<ActiveSession[]> {
    const rows = await prisma.loginSession.findMany({ where: { userId }, orderBy: { lastSeenAt: 'desc' } });
    const alive = await prisma.session.findMany({
      where: { sid: { in: rows.map((r) => r.sid) }, expire: { gt: new Date() } },
      select: { sid: true },
    });
    const aliveSids = new Set(alive.map((s) => s.sid));
    const stale = rows.filter((r) => !aliveSids.has(r.sid)).map((r) => r.id);
    if (stale.length) await prisma.loginSession.deleteMany({ where: { id: { in: stale } } });

    return rows
      .filter((r) => aliveSids.has(r.sid))
      .map((r) => ({
        id: r.id,
        current: r.sid === currentSid,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        createdAt: r.createdAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
      }));
  },

  async revokeSession(userId: string, loginSessionId: string, currentSid: string, req: Request) {
    // userId in the WHERE: you can only sign out your own devices.
    const row = await prisma.loginSession.findFirst({ where: { id: loginSessionId, userId } });
    if (!row) throw new HttpError(404, 'Session not found');
    if (row.sid === currentSid) throw new HttpError(400, 'Use "Sign out" to end this session');
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { sid: row.sid } }),
      prisma.loginSession.delete({ where: { id: row.id } }),
    ]);
    await audit(userId, 'SESSIONS_REVOKED', req);
  },

  async revokeOtherSessions(userId: string, req: Request) {
    const count = await signOutEverywhere(userId, req.sessionID);
    if (count > 0) await audit(userId, 'SESSIONS_REVOKED', req);
    return count;
  },

  async securityHistory(userId: string): Promise<AuditEntry[]> {
    const rows = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      event: r.event,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    }));
  },
};
