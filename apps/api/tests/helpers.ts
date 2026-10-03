// Shared helpers for API tests. Each "agent" is like a separate browser:
// it keeps its own cookies between requests. See docs/15-testing.md.
import { randomUUID } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { testOutbox } from '../src/lib/mailer.js';

/** The app with very high rate limits, so tests can sign in many times. */
export const app = createApp({ rateLimits: 'relaxed' });

export const PASSWORD = 'correct horse battery staple';

export type Browser = {
  agent: TestAgent;
  csrf: string;
  post: (url: string, body?: object) => request.Test;
  del: (url: string) => request.Test;
};

/** A fresh "browser" that has fetched its CSRF token. */
export async function newBrowser(targetApp = app): Promise<Browser> {
  const agent = request.agent(targetApp);
  const res = await agent.get('/api/auth/csrf').expect(200);
  const browser: Browser = {
    agent,
    csrf: res.body.csrfToken,
    post: (url, body = {}) => agent.post(url).set('X-CSRF-Token', browser.csrf).send(body),
    del: (url) => agent.delete(url).set('X-CSRF-Token', browser.csrf),
  };
  return browser;
}

export const uniqueEmail = () => `student-${randomUUID()}@test.dev`;

/** The newest email sent to `to`. */
export function lastEmailTo(to: string) {
  const mail = [...testOutbox].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`No email was sent to ${to}`);
  return mail;
}

/** Pull the ?token=... out of an emailed link. */
export function tokenFromEmail(to: string, path: string) {
  const match = lastEmailTo(to).text.match(new RegExp(`${path}\\?token=([^\\s]+)`));
  if (!match?.[1]) throw new Error(`No ${path} link in the email to ${to}`);
  return decodeURIComponent(match[1]);
}

/** Register through the API and click the verification link. */
export async function registerVerifiedUser(email = uniqueEmail()) {
  const browser = await newBrowser();
  await browser
    .post('/api/auth/register', { email, displayName: 'Test Student', password: PASSWORD })
    .expect(202);
  await browser.post('/api/auth/verify-email', { token: tokenFromEmail(email, '/verify-email') }).expect(200);
  return email;
}

/** Sign in in a new browser. Returns the browser with its post-login CSRF token. */
export async function login(email: string, password = PASSWORD) {
  const browser = await newBrowser();
  const res = await browser.post('/api/auth/login', { email, password }).expect(200);
  browser.csrf = res.body.csrfToken;
  return { browser, body: res.body as { mfaRequired: boolean; csrfToken: string } };
}

/** A verified user who is signed in. */
export async function signedInUser() {
  const email = await registerVerifiedUser();
  const { browser } = await login(email);
  return { email, browser };
}

/** The 6-digit code an authenticator app would show, `stepsAhead` 30-second steps from now. */
export function totpCode(manualKey: string, stepsAhead = 0) {
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(manualKey), digits: 6, period: 30 });
  return totp.generate({ timestamp: Date.now() + stepsAhead * 30_000 });
}
