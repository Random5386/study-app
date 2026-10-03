// Unit tests for the small security helpers: no database, no HTTP.
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto.js';
import { createRecoveryCode, createToken, hashRecoveryCode, hashToken } from './tokens.js';

describe('encrypt / decrypt (AES-256-GCM)', () => {
  it('round-trips and produces different ciphertext each time', () => {
    const a = encrypt('JBSWY3DPEHPK3PXP');
    const b = encrypt('JBSWY3DPEHPK3PXP');
    expect(a).not.toEqual(b); // random IV
    expect(decrypt(a)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('refuses tampered ciphertext', () => {
    const [iv, tag, data] = encrypt('secret').split('.');
    const flipped = Buffer.from(data!, 'base64url');
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decrypt([iv, tag, flipped.toString('base64url')].join('.'))).toThrow();
  });
});

describe('tokens', () => {
  it('stores only a hash of the emailed token', () => {
    const { raw, hash } = createToken();
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(hash).toBe(hashToken(raw));
    expect(hash).not.toContain(raw);
  });

  it('accepts recovery codes typed with different case and spacing', () => {
    const code = createRecoveryCode();
    expect(code).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(hashRecoveryCode(code.toUpperCase().replace('-', ' '))).toBe(hashRecoveryCode(code));
  });
});
