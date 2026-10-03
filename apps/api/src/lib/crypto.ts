// AES-256-GCM encryption for secrets we must read back later (TOTP secrets).
// Passwords are HASHED instead, because we never need them back. See docs/07-mfa-totp.md.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const key = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes = 256 bits, kept in .env, not the database

/** Encrypt text. Output: "<iv>.<authTag>.<ciphertext>" in base64url. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12); // a new random IV every time
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // lets decrypt() detect tampering
  return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((part) => Buffer.from(part, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'); // throws if tampered
}
