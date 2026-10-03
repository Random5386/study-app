// Business rules for accounts: register, verify email, log in, reset password.
// Routes (auth.routes.ts) deal with HTTP; this file deals with users and the database.
// See docs/06-authentication-sessions.md.
import type { Request } from 'express';
import type { LoginInput, PublicUser, RegisterInput } from '@studyapp/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma, type AuthTokenType, type User } from '../../generated/prisma/client.js';
import { audit, requestInfo } from '../../lib/audit.js';
import { HttpError } from '../../lib/httpError.js';
import {
  hashPassword,
  isBreachedPassword,
  spendPasswordCheckTime,
  verifyPassword,
} from '../../lib/passwords.js';
import { createToken, hashToken } from '../../lib/tokens.js';
import { emails } from './emails.js';

const LOCK_AFTER_FAILURES = 5;
const LOCK_MINUTES = 15;
const HOUR = 60 * 60 * 1000;
const TOKEN_LIFETIME: Record<AuthTokenType, number> = {
  EMAIL_VERIFY: 24 * HOUR,
  PASSWORD_RESET: 30 * 60 * 1000,
};

/** The only user fields that ever leave the server. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.mfaEnabledAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Reject passwords found in known data breaches. */
export async function assertPasswordNotBreached(password: string) {
  if (await isBreachedPassword(password)) {
    throw new HttpError(
      400,
      'This password has appeared in a data breach, so attackers try it first. Please choose a different one.',
    );
  }
}

/** Make a single-use link token (older unused ones of the same type stop working). */
async function issueToken(userId: string, type: AuthTokenType) {
  const { raw, hash } = createToken();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({
      data: { userId, type, tokenHash: hash, expiresAt: new Date(Date.now() + TOKEN_LIFETIME[type]) },
    }),
  ]);
  return raw;
}

/** Use up a link token. Returns its user id, or throws if it's unknown, used or expired. */
async function consumeToken(raw: string, type: AuthTokenType): Promise<string> {
  const tokenHash = hashToken(raw);
  // One atomic UPDATE: two clicks at the same moment can't both succeed.
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count === 0) throw new HttpError(400, 'This link is invalid or has expired. Request a new one.');
  const token = await prisma.authToken.findUniqueOrThrow({ where: { tokenHash } });
  return token.userId;
}

export const authService = {
  async register(input: RegisterInput, req: Request) {
    await assertPasswordNotBreached(input.password);
    try {
      const user = await prisma.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash: await hashPassword(input.password),
        },
      });
      await audit(user.id, 'REGISTERED', req);
      await emails.verifyEmail(user.email, user.displayName, await issueToken(user.id, 'EMAIL_VERIFY'));
    } catch (err) {
      // P2002 = unique constraint failed → the email is already registered.
      // Tell the real owner by email; tell the requester nothing (stops account enumeration).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await emails.alreadyRegistered(input.email);
        return;
      }
      throw err;
    }
  },

  async verifyEmail(rawToken: string, req: Request) {
    const userId = await consumeToken(rawToken, 'EMAIL_VERIFY');
    const user = await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    await audit(user.id, 'EMAIL_VERIFIED', req);
    return user;
  },

  async resendVerification(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt) return; // same response either way
    await emails.verifyEmail(user.email, user.displayName, await issueToken(user.id, 'EMAIL_VERIFY'));
  },

  /** Check email + password. Returns the user, or throws a deliberately vague error. */
  async login({ email, password }: LoginInput, req: Request): Promise<User> {
    const invalid = new HttpError(401, 'Email or password is incorrect');
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      await spendPasswordCheckTime(password); // same timing as a real check
      throw invalid;
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpError(
        429,
        'Too many failed attempts. Try again in a few minutes, or reset your password.',
      );
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      const failed = user.failedLogins + 1;
      const lock = failed >= LOCK_AFTER_FAILURES;
      await prisma.user.update({
        where: { id: user.id },
        data: lock
          ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLogins: failed },
      });
      await audit(user.id, lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED', req);
      throw invalid;
    }
    if (!user.emailVerifiedAt) {
      throw new HttpError(403, 'Please confirm your email address first. Check your inbox for the link.', {
        reason: 'EMAIL_NOT_VERIFIED',
      });
    }
    if (user.failedLogins > 0 || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    }
    return user;
  },

  async forgotPassword(email: string, req: Request) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return; // same response either way
    await audit(user.id, 'PASSWORD_RESET_REQUESTED', req);
    await emails.resetPassword(user.email, user.displayName, await issueToken(user.id, 'PASSWORD_RESET'));
  },

  async resetPassword(rawToken: string, newPassword: string, req: Request) {
    await assertPasswordNotBreached(newPassword);
    const userId = await consumeToken(rawToken, 'PASSWORD_RESET');
    const passwordHash = await hashPassword(newPassword);
    const user = await prisma.user.update({
      where: { id: userId },
      // Clicking the emailed link also proves the address, and a reset unlocks the account.
      data: { passwordHash, failedLogins: 0, lockedUntil: null, emailVerifiedAt: new Date() },
    });
    await signOutEverywhere(user.id); // anyone using the old password is kicked out
    await audit(user.id, 'PASSWORD_RESET', req);
    await emails.passwordChanged(user.email, user.displayName);
  },

  /** Remember this signed-in device for the "Active sessions" page. */
  async recordLoginSession(userId: string, req: Request) {
    await prisma.loginSession.create({ data: { userId, sid: req.sessionID, ...requestInfo(req) } });
  },

  async forgetLoginSession(sid: string) {
    await prisma.loginSession.deleteMany({ where: { sid } });
  },

  async getUser(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new HttpError(401, 'Please log in');
    return user;
  },
};

/** Delete every session of a user, optionally keeping one (the current device). */
export async function signOutEverywhere(userId: string, keepSid?: string) {
  const rows = await prisma.loginSession.findMany({
    where: { userId, ...(keepSid ? { NOT: { sid: keepSid } } : {}) },
    select: { sid: true },
  });
  const sids = rows.map((r) => r.sid);
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { sid: { in: sids } } }), // their cookies stop working at once
    prisma.loginSession.deleteMany({ where: { sid: { in: sids } } }),
  ]);
  return sids.length;
}
