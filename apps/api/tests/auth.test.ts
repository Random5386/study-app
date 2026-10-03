// Registration, email verification, sign-in, sign-out and password reset.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import {
  app,
  lastEmailTo,
  login,
  newBrowser,
  PASSWORD,
  registerVerifiedUser,
  signedInUser,
  tokenFromEmail,
  uniqueEmail,
} from './helpers.js';

describe('registration and email verification', () => {
  it('registers, verifies the email, then signs in', async () => {
    const email = uniqueEmail();
    const browser = await newBrowser();

    await browser
      .post('/api/auth/register', {
        email: `  ${email.toUpperCase()} `,
        displayName: 'Ada',
        password: PASSWORD,
      })
      .expect(202);

    // Stored lower-case and hashed, never as plain text.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.emailVerifiedAt).toBeNull();

    // Can't sign in before clicking the link.
    const early = await browser.post('/api/auth/login', { email, password: PASSWORD }).expect(403);
    expect(early.body.details).toEqual({ reason: 'EMAIL_NOT_VERIFIED' });

    await browser
      .post('/api/auth/verify-email', { token: tokenFromEmail(email, '/verify-email') })
      .expect(200);
    const { browser: signedIn, body } = await login(email);
    expect(body.mfaRequired).toBe(false);

    const me = await signedIn.agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ email, displayName: 'Ada', emailVerified: true, mfaEnabled: false });
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|totp/);
  });

  it('gives the same answer for a taken email, and warns the real owner by email', async () => {
    const email = await registerVerifiedUser();
    const browser = await newBrowser();
    const res = await browser
      .post('/api/auth/register', { email, displayName: 'Impostor', password: PASSWORD })
      .expect(202);
    expect(res.body.message).toMatch(/Check your inbox/);
    expect(lastEmailTo(email).subject).toMatch(/tried to sign up/);
  });

  it('verification links work only once', async () => {
    const email = uniqueEmail();
    const browser = await newBrowser();
    await browser.post('/api/auth/register', { email, displayName: 'Bo', password: PASSWORD }).expect(202);
    const token = tokenFromEmail(email, '/verify-email');
    await browser.post('/api/auth/verify-email', { token }).expect(200);
    await browser.post('/api/auth/verify-email', { token }).expect(400);
  });

  it('rejects short passwords and invalid emails', async () => {
    const browser = await newBrowser();
    const res = await browser
      .post('/api/auth/register', { email: 'not-an-email', displayName: 'X', password: 'short' })
      .expect(400);
    expect(res.body.error).toBe('Invalid input');
  });
});

describe('signing in', () => {
  it('uses the same message for an unknown email and a wrong password', async () => {
    const email = await registerVerifiedUser();
    const browser = await newBrowser();
    const wrong = await browser.post('/api/auth/login', { email, password: 'wrong password!!' }).expect(401);
    const unknown = await browser
      .post('/api/auth/login', { email: uniqueEmail(), password: 'wrong password!!' })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('locks the account for 15 minutes after 5 wrong passwords', async () => {
    const email = await registerVerifiedUser();
    const browser = await newBrowser();
    for (let i = 0; i < 5; i++) {
      await browser.post('/api/auth/login', { email, password: 'wrong password!!' }).expect(401);
    }
    // Even the right password is refused while locked.
    await browser.post('/api/auth/login', { email, password: PASSWORD }).expect(429);

    const events = await prisma.auditLog.findMany({ where: { user: { email } }, select: { event: true } });
    expect(events.map((e) => e.event)).toContain('ACCOUNT_LOCKED');
  });

  it('gives the session a new id at login (stops session fixation)', async () => {
    const email = await registerVerifiedUser();
    const browser = await newBrowser();
    const before = await browser.agent.get('/api/auth/csrf');
    const beforeCookie = String(before.headers['set-cookie'] ?? '');
    const res = await browser.post('/api/auth/login', { email, password: PASSWORD }).expect(200);
    const afterCookie = String(res.headers['set-cookie']);
    expect(afterCookie).toMatch(/studyapp\.sid=/);
    expect(afterCookie).toMatch(/HttpOnly/);
    expect(afterCookie).toMatch(/SameSite=Strict/);
    expect(afterCookie).not.toEqual(beforeCookie);
  });

  it('requires a CSRF token for changes', async () => {
    const email = await registerVerifiedUser();
    const browser = await newBrowser();
    await browser.agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(403);
    await browser.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', 'made-up-token')
      .send({ email, password: PASSWORD })
      .expect(403);
  });

  it('refuses /me without a session', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('/session answers 200 with user: null when signed out', async () => {
    const res = await request(app).get('/api/auth/session').expect(200);
    expect(res.body).toEqual({ user: null, mfaPending: false });

    const { email, browser } = await signedInUser();
    const signedIn = await browser.agent.get('/api/auth/session').expect(200);
    expect(signedIn.body.user.email).toBe(email);
  });

  it('signs out and the old cookie stops working', async () => {
    const { browser } = await signedInUser();
    await browser.post('/api/auth/logout').expect(204);
    await browser.agent.get('/api/auth/me').expect(401);
  });
});

describe('password reset', () => {
  it('resets the password, signs out every device, and the link works once', async () => {
    const { email, browser: oldDevice } = await signedInUser();
    const browser = await newBrowser();

    await browser.post('/api/auth/forgot-password', { email }).expect(202);
    const token = tokenFromEmail(email, '/reset-password');
    const newPassword = 'a brand new long password';
    await browser.post('/api/auth/reset-password', { token, password: newPassword }).expect(200);
    await browser.post('/api/auth/reset-password', { token, password: newPassword }).expect(400);

    await oldDevice.agent.get('/api/auth/me').expect(401); // kicked out
    await login(email, newPassword); // new password works
    await newBrowser().then((b) => b.post('/api/auth/login', { email, password: PASSWORD }).expect(401));
  });

  it('answers the same for unknown emails', async () => {
    const browser = await newBrowser();
    const res = await browser.post('/api/auth/forgot-password', { email: uniqueEmail() }).expect(202);
    expect(res.body.message).toMatch(/Check your inbox/);
  });
});
