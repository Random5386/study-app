// Security settings: changing the password, active sessions, security history,
// and proof that one user can't touch another user's sessions.
import { describe, expect, it } from 'vitest';
import { login, PASSWORD, signedInUser } from './helpers.js';

describe('active sessions', () => {
  it('lists each signed-in device and marks the current one', async () => {
    const { email, browser: laptop } = await signedInUser();
    await login(email); // a second device

    const res = await laptop.agent.get('/api/account/sessions').expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
  });

  it('"sign out other devices" ends their sessions but keeps this one', async () => {
    const { email, browser: laptop } = await signedInUser();
    const { browser: phone } = await login(email);

    const res = await laptop.post('/api/account/sessions/revoke-others').expect(200);
    expect(res.body.revoked).toBe(1);
    await phone.agent.get('/api/auth/me').expect(401);
    await laptop.agent.get('/api/auth/me').expect(200);
  });

  it("can't sign out another user's device (404, not 403)", async () => {
    const alice = await signedInUser();
    const bob = await signedInUser();
    const bobSessions = await bob.browser.agent.get('/api/account/sessions').expect(200);

    await alice.browser.del(`/api/account/sessions/${bobSessions.body[0].id}`).expect(404);
    await bob.browser.agent.get('/api/auth/me').expect(200); // Bob is still signed in
  });
});

describe('changing the password', () => {
  it('needs the current password', async () => {
    const { browser } = await signedInUser();
    await browser
      .post('/api/account/password', { currentPassword: 'wrong one', newPassword: 'another long password' })
      .expect(401);
  });

  it('signs out other devices and records it in the security history', async () => {
    const { email, browser: laptop } = await signedInUser();
    const { browser: phone } = await login(email);

    await laptop
      .post('/api/account/password', { currentPassword: PASSWORD, newPassword: 'another long password' })
      .expect(200);
    await phone.agent.get('/api/auth/me').expect(401);
    await laptop.agent.get('/api/auth/me').expect(200);

    const history = await laptop.agent.get('/api/account/security-history').expect(200);
    const events = history.body.map((e: { event: string }) => e.event);
    expect(events).toEqual(
      expect.arrayContaining(['REGISTERED', 'EMAIL_VERIFIED', 'LOGIN', 'PASSWORD_CHANGED']),
    );
  });
});
