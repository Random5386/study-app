// Two-factor sign-in with authenticator apps (TOTP). See docs/07-mfa-totp.md.
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import type { MfaSetupResponse } from '@studyapp/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { User } from '../../generated/prisma/client.js';
import { decrypt, encrypt } from '../../lib/crypto.js';
import { HttpError } from '../../lib/httpError.js';
import { createRecoveryCode, hashRecoveryCode } from '../../lib/tokens.js';

const PERIOD = 30; // seconds per code
const RECOVERY_CODE_COUNT = 10;

const buildTotp = (email: string, secret: OTPAuth.Secret) =>
  new OTPAuth.TOTP({
    issuer: env.APP_NAME,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
    secret,
  });

const currentStep = (now = Date.now()) => Math.floor(now / 1000 / PERIOD);

/** Make 10 fresh recovery codes, replacing any old ones. Returns the plain codes (shown once). */
async function replaceRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, createRecoveryCode);
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hashRecoveryCode(c) })) }),
  ]);
  return codes;
}

export type CodeCheck = 'totp' | 'recovery' | null;

export const mfaService = {
  /** Step 1: create a secret (saved encrypted, not active yet) and a QR code for the app. */
  async startSetup(user: User): Promise<MfaSetupResponse> {
    if (user.mfaEnabledAt) throw new HttpError(409, 'Two-factor sign-in is already on');
    const secret = new OTPAuth.Secret({ size: 20 }); // 160 random bits
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecretEnc: encrypt(secret.base32), totpLastStep: null },
    });
    const uri = buildTotp(user.email, secret).toString(); // otpauth://totp/StudyApp:you@x.com?secret=...
    return {
      qrCodeDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }),
      manualKey: secret.base32,
    };
  },

  /** Step 2: prove the app works by typing a code. Turns MFA on and returns recovery codes. */
  async confirmSetup(user: User, code: string): Promise<string[]> {
    if (user.mfaEnabledAt) throw new HttpError(409, 'Two-factor sign-in is already on');
    if (!user.totpSecretEnc) throw new HttpError(400, 'Start two-factor setup first');
    if (!(await checkTotp(user, code)))
      throw new HttpError(400, 'That code is not right. Try the newest one.');
    await prisma.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date() } });
    return replaceRecoveryCodes(user.id);
  },

  /** Accepts a current authenticator code, or an unused recovery code (which is then used up). */
  async verifyCode(user: User, code: string): Promise<CodeCheck> {
    if (!user.mfaEnabledAt || !user.totpSecretEnc) return null;
    if (/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      return (await checkTotp(user, code)) ? 'totp' : null;
    }
    const { count } = await prisma.recoveryCode.updateMany({
      where: { userId: user.id, codeHash: hashRecoveryCode(code), usedAt: null },
      data: { usedAt: new Date() },
    });
    return count > 0 ? 'recovery' : null;
  },

  async disable(userId: string) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { mfaEnabledAt: null, totpSecretEnc: null, totpLastStep: null },
      }),
      prisma.recoveryCode.deleteMany({ where: { userId } }),
    ]);
  },

  regenerateRecoveryCodes(user: User): Promise<string[]> {
    if (!user.mfaEnabledAt) throw new HttpError(400, 'Turn on two-factor sign-in first');
    return replaceRecoveryCodes(user.id);
  },

  async remainingRecoveryCodes(userId: string) {
    return prisma.recoveryCode.count({ where: { userId, usedAt: null } });
  },
};

/**
 * Is `code` the right 6-digit code right now? Accepts the previous/next 30-second step
 * for clock drift, and refuses a code from a step that was already used (replay protection).
 */
async function checkTotp(user: User, code: string): Promise<boolean> {
  if (!user.totpSecretEnc) return false;
  const totp = buildTotp(user.email, OTPAuth.Secret.fromBase32(decrypt(user.totpSecretEnc)));
  const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 });
  if (delta === null) return false;

  const step = currentStep() + delta;
  // Atomic: only succeeds if this step is newer than the last one used.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step },
  });
  return count === 1;
}
