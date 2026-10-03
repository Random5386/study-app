// Random tokens for emailed links and recovery codes. Only hashes are stored,
// so a database leak doesn't hand out working links. See docs/06-authentication-sessions.md.
import { createHash, randomBytes } from 'node:crypto';

/** A random token for a link, plus the hash to store. */
export function createToken() {
  const raw = randomBytes(32).toString('base64url'); // goes in the emailed link
  return { raw, hash: hashToken(raw) }; // only the hash goes in the database
}

export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** A recovery code like "a1b2c-3d4e5" (40 random bits, easy to type). */
export function createRecoveryCode(): string {
  const hex = randomBytes(5).toString('hex');
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
}

/** Hash a recovery code after normalising what the user typed ("A1B2C 3D4E5" → "a1b2c3d4e5"). */
export const hashRecoveryCode = (code: string) => hashToken(code.toLowerCase().replace(/[^0-9a-f]/g, ''));
