// Password hashing and breach checks. See docs/06-authentication-sessions.md.
import { createHash } from 'node:crypto';
import argon2 from 'argon2';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** Hash a password with argon2id (salted automatically, deliberately slow). */
export const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });

/** True if `plain` matches the stored hash. */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false; // malformed hash: treat as "doesn't match"
  }
}

// A real hash of a random password. Checking against it when an email doesn't exist
// makes "unknown email" take as long as "wrong password", so timing can't reveal accounts.
let dummyHash: Promise<string> | undefined;
export async function spendPasswordCheckTime(plain: string) {
  dummyHash ??= hashPassword(createHash('sha256').update(String(Math.random())).digest('hex'));
  await verifyPassword(await dummyHash, plain);
}

/** Has this password appeared in a known data breach? (Skipped when PASSWORD_BREACH_CHECK=off.) */
export async function isBreachedPassword(plain: string): Promise<boolean> {
  if (env.PASSWORD_BREACH_CHECK === 'off') return false;
  return lookupPwnedPassword(plain);
}

/**
 * Asks the free Pwned Passwords "range" API using k-anonymity:
 * only the first 5 characters of the password's SHA-1 hash ever leave our server.
 * (SHA-1 is fine here: it's a lookup key for the breach list, not how we store passwords.)
 */
export async function lookupPwnedPassword(plain: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(plain).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true', 'User-Agent': `${env.APP_NAME}-password-check` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`Pwned Passwords answered ${res.status}`);
    const body = await res.text();
    return body.split('\n').some((line) => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) > 0; // padding rows have a count of 0
    });
  } catch (err) {
    // "Fail open": if the service is down, don't block sign-ups.
    logger.warn({ err }, 'Pwned Passwords check failed; allowing password');
    return false;
  }
}
