// Unit tests for password helpers. The breach-list API is faked: tests never call the internet.
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword, lookupPwnedPassword, verifyPassword } from './passwords.js';

const suffixOf = (pw: string) => createHash('sha1').update(pw).digest('hex').toUpperCase().slice(5);
const fakeRange = (body: string, status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status }));

describe('hashPassword / verifyPassword', () => {
  it('hashes with argon2id and verifies only the right password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
  });
});

describe('lookupPwnedPassword (k-anonymity)', () => {
  it('finds a breached password and sends only 5 hash characters', async () => {
    const spy = fakeRange(`${suffixOf('password1234')}:5021\r\nABCDEF0123456789ABCDEF0123456789ABC:3`);
    expect(await lookupPwnedPassword('password1234')).toBe(true);
    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toMatch(/\/range\/[0-9A-F]{5}$/);
    expect(url).not.toContain('password1234');
    spy.mockRestore();
  });

  it('ignores padding rows with a count of 0', async () => {
    const spy = fakeRange(`${suffixOf('a long unique passphrase')}:0`);
    expect(await lookupPwnedPassword('a long unique passphrase')).toBe(false);
    spy.mockRestore();
  });

  it('allows the password if the service is down (fail open)', async () => {
    const spy = fakeRange('Service unavailable', 503);
    expect(await lookupPwnedPassword('password1234')).toBe(false);
    spy.mockRestore();
  });
});
