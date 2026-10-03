# 7. Multi-factor authentication (TOTP)

> **In the real code (phase 2):** see `apps/api/src/modules/account/mfa.service.ts`. The "stretch" replay protection from the end of this page is already built: `User.totpLastStep` records the last accepted 30-second step, and an atomic `updateMany` refuses a code from the same step twice. Tests: `apps/api/tests/mfa.test.ts`.

## What it is

**MFA** asks for a second proof of identity beyond the password. StudyApp uses **TOTP** (Time-based One-Time Password) — the 6-digit codes in Google Authenticator or Microsoft Authenticator.

How TOTP works:

1. When you turn MFA on, the server creates a random **secret** and shows it as a QR code.
2. Your authenticator app scans it. Now **both** sides know the secret.
3. Every 30 seconds, both sides compute `HMAC(secret, current 30-second time step)` → a 6-digit number.
4. At login you type the code from your phone; the server computes its own and compares.

The secret never travels again after setup, and each code expires in 30 seconds. A stolen password alone is no longer enough.

## Why we use it

- It's free — no SMS costs (SMS is also weaker: SIM-swap attacks).
- Standard (RFC 6238), works with every authenticator app.
- The original StudySync had MFA; this version adds encrypted secrets, recovery codes and rate limiting.

Libraries: `otpauth` (generates/validates codes, builds the `otpauth://` URI) and `qrcode` (turns the URI into an image). Alternatives: `otplib`, or passkeys/WebAuthn (a stretch goal — phishing-resistant, but more complex).

## Where it lives

```
apps/api/src/modules/auth/mfa.service.ts
apps/api/src/modules/auth/auth.routes.ts   # /mfa/setup, /mfa/confirm, /mfa/verify, /mfa/disable
apps/api/src/lib/crypto.ts                 # AES-256-GCM encrypt/decrypt
apps/web/src/features/auth/MfaSetupPage.tsx, MfaVerifyPage.tsx
```

## The code, explained

### Encrypting the secret at rest — `lib/crypto.ts`

If the database leaked and TOTP secrets were plain text, an attacker could generate valid codes. So we encrypt them with **AES-256-GCM** using `ENCRYPTION_KEY` from `.env` (which is _not_ in the database).

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes = 256 bits

export function encrypt(plain: string): string {
  const iv = randomBytes(12); // new random IV every time
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // detects tampering
  return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
```

- **IV** (initialisation vector): must be unique per encryption so the same secret encrypts differently each time.
- **GCM auth tag**: if anyone alters the ciphertext, `decipher.final()` throws instead of returning garbage.
- Hashing vs encryption: passwords are **hashed** (we never need them back); TOTP secrets are **encrypted** (we must get them back to compute codes).

### Turning MFA on — `mfa.service.ts`

```ts
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { randomBytes, createHash } from 'node:crypto';

const buildTotp = (email: string, secret: OTPAuth.Secret) =>
  new OTPAuth.TOTP({ issuer: env.APP_NAME, label: email, algorithm: 'SHA1', digits: 6, period: 30, secret });

export const mfaService = {
  /** Step 1: create a secret, save it (encrypted, not yet active), return a QR code. */
  async startSetup(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabledAt) throw new HttpError(409, 'MFA is already on');

    const secret = new OTPAuth.Secret({ size: 20 }); // 160 random bits
    await prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: encrypt(secret.base32) } });

    const uri = buildTotp(user.email, secret).toString(); // otpauth://totp/StudyApp:you@x.com?secret=...
    return { qrCodeDataUrl: await QRCode.toDataURL(uri), manualKey: secret.base32 };
  },

  /** Step 2: the user types a code to prove the app is set up; we switch MFA on. */
  async confirmSetup(userId: string, code: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpSecretEnc || user.mfaEnabledAt) throw new HttpError(400, 'Start MFA setup first');
    if (!checkTotp(user.email, user.totpSecretEnc, code)) throw new HttpError(400, 'That code is not right');

    const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(5).toString('hex')); // e.g. "a3f09c1b2e"
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { mfaEnabledAt: new Date() } }),
      prisma.recoveryCode.deleteMany({ where: { userId } }),
      prisma.recoveryCode.createMany({
        data: recoveryCodes.map((c) => ({ userId, codeHash: sha256(c) })),
      }),
    ]);
    await audit(userId, 'MfaEnabled');
    return { recoveryCodes }; // shown ONCE; we only keep hashes
  },
};

function checkTotp(email: string, secretEnc: string, code: string): boolean {
  const totp = buildTotp(email, OTPAuth.Secret.fromBase32(decrypt(secretEnc)));
  // window: 1 accepts the previous/next 30-second step too, to allow for clock drift.
  return totp.validate({ token: code.replace(/\s/g, ''), window: 1 }) !== null;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
```

Recovery codes are long random strings, so a fast hash (SHA-256) is fine for them — unlike human-chosen passwords.

### Logging in with MFA

After the password step, the session has `userId` **and** `mfaPending: true`. `requireAuth` (page 04) refuses everything except the MFA endpoint until the code is verified:

```ts
authRouter.post('/mfa/verify', mfaLimiter, validateBody(mfaCodeSchema), async (req, res) => {
  const userId = req.session.userId;
  if (!userId || !req.session.mfaPending) throw new HttpError(400, 'No sign-in in progress');

  const ok = await mfaService.verifyLogin(userId, req.body.code); // TOTP code OR an unused recovery code
  if (!ok) {
    await audit(userId, 'FailedMfa', req.ip);
    throw new HttpError(401, 'That code is not right');
  }

  await regenerateSession(req); // new id again: privileges just went up
  req.session.userId = userId;
  req.session.mfaPending = false;
  res.json({ ok: true, csrfToken: issueCsrfToken(req) }); // new session → new CSRF token (page 08)
});
```

`verifyLogin` tries the TOTP code first; if that fails it hashes the input and looks for a matching **unused** recovery code, marking it used (`usedAt = now`) so it can't be used twice.

### Turning MFA off

Requires the current password **and** a valid code, then clears `totpSecretEnc`, `mfaEnabledAt` and the recovery codes, and writes `MfaDisabled` to the audit log. Security settings should always demand fresh proof.

## Common mistakes

- Storing the TOTP secret in plain text.
- Marking MFA "on" before the user has proven their app works (they'd be locked out).
- No rate limit on the code endpoint — a 6-digit code has only 1,000,000 options. We allow 5 attempts per minute.
- Forgetting recovery codes, so a lost phone means a lost account.
- Letting a half-logged-in session (password OK, MFA pending) reach the rest of the API.

## Interview questions

**Q: How does TOTP work?**
A: Server and app share a secret at setup via QR code. Each side computes an HMAC of the secret and the current 30-second time step, truncated to 6 digits. The server accepts a code that matches the current step, or one step either side for clock drift.

**Q: How do you store the TOTP secret?**
A: Encrypted with AES-256-GCM using a key from the environment, not the database, with a random IV per encryption and an auth tag to detect tampering.

**Q: Why not SMS codes?**
A: SMS costs money per message and is vulnerable to SIM-swap attacks. Authenticator apps are free, offline and stronger.

**Q: What happens if a user loses their phone?**
A: They use one of ten single-use recovery codes shown at setup. We store only their hashes and mark each one used.

## Try it yourself

1. Turn on MFA for the demo account with your phone. Log out and back in.
2. Use a recovery code instead of the app. Try the same recovery code again — it must fail.
3. **Stretch:** add replay protection: store the last accepted time step on the user and reject a code from the same step twice.
