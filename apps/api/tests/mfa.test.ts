// Two-factor sign-in: setup, sign-in with a code, recovery codes, replay protection, turning it off.
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { login, PASSWORD, signedInUser, totpCode, type Browser } from './helpers.js';

/** Turn MFA on for a signed-in browser. Returns the secret and recovery codes. */
async function enableMfa(browser: Browser) {
  const setup = await browser.post('/api/account/mfa/setup', { password: PASSWORD }).expect(200);
  expect(setup.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
  const manualKey: string = setup.body.manualKey;

  const confirm = await browser.post('/api/account/mfa/confirm', { code: totpCode(manualKey) }).expect(200);
  const recoveryCodes: string[] = confirm.body.recoveryCodes;
  return { manualKey, recoveryCodes };
}

describe('two-factor sign-in (TOTP)', () => {
  it('asks for the password before starting setup', async () => {
    const { browser } = await signedInUser();
    await browser.post('/api/account/mfa/setup', { password: 'not my password' }).expect(401);
  });

  it('stores the secret encrypted and gives 10 recovery codes', async () => {
    const { email, browser } = await signedInUser();
    const { manualKey, recoveryCodes } = await enableMfa(browser);

    expect(recoveryCodes).toHaveLength(10);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.mfaEnabledAt).not.toBeNull();
    expect(user.totpSecretEnc).not.toContain(manualKey); // encrypted, not plain
    const stored = await prisma.recoveryCode.findMany({ where: { userId: user.id } });
    expect(stored.map((c) => c.codeHash)).not.toContain(recoveryCodes[0]); // hashed, not plain
  });

  it('requires the code after the password, and blocks everything until then', async () => {
    const { email, browser } = await signedInUser();
    const { manualKey } = await enableMfa(browser);

    const { browser: phone, body } = await login(email);
    expect(body.mfaRequired).toBe(true);
    await phone.agent.get('/api/auth/me').expect(403); // half signed in: not allowed yet
    await phone.agent.get('/api/account/sessions').expect(403);

    await phone.post('/api/auth/mfa/verify', { code: '000000' }).expect(401);

    // The setup step used the current code, so use the next one (apps show it 30 s later).
    const code = totpCode(manualKey, 1);
    const ok = await phone.post('/api/auth/mfa/verify', { code }).expect(200);
    phone.csrf = ok.body.csrfToken;
    await phone.agent.get('/api/auth/me').expect(200);
  });

  it('refuses the same code twice (replay protection)', async () => {
    const { email, browser } = await signedInUser();
    const { manualKey } = await enableMfa(browser);
    const code = totpCode(manualKey, 1);

    const first = await login(email);
    await first.browser.post('/api/auth/mfa/verify', { code }).expect(200);

    const second = await login(email);
    await second.browser.post('/api/auth/mfa/verify', { code }).expect(401);
  });

  it('accepts each recovery code exactly once', async () => {
    const { email, browser } = await signedInUser();
    const { recoveryCodes } = await enableMfa(browser);
    const code = recoveryCodes[0]!.toUpperCase().replace('-', ' '); // typing it differently still works

    const first = await login(email);
    await first.browser.post('/api/auth/mfa/verify', { code }).expect(200);

    const second = await login(email);
    await second.browser.post('/api/auth/mfa/verify', { code }).expect(401);
  });

  it('turns off only with the password and a valid code', async () => {
    const { email, browser } = await signedInUser();
    const { recoveryCodes } = await enableMfa(browser);

    await browser
      .post('/api/account/mfa/disable', { password: 'wrong password', code: recoveryCodes[1] })
      .expect(401);
    await browser
      .post('/api/account/mfa/disable', { password: PASSWORD, code: recoveryCodes[1] })
      .expect(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.mfaEnabledAt).toBeNull();
    expect(user.totpSecretEnc).toBeNull();
    expect((await login(email)).body.mfaRequired).toBe(false);
  });
});
