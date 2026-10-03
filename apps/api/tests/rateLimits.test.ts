// Uses an app with the REAL rate limits (other tests use relaxed ones).
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { newBrowser, uniqueEmail } from './helpers.js';

describe('rate limits', () => {
  it('blocks the 11th sign-in attempt for one email within a minute', async () => {
    const strictApp = createApp();
    const browser = await newBrowser(strictApp);
    const email = uniqueEmail();

    for (let i = 0; i < 10; i++) {
      await browser.post('/api/auth/login', { email, password: 'guess number ' + i }).expect(401);
    }
    const blocked = await browser.post('/api/auth/login', { email, password: 'one more guess' }).expect(429);
    expect(blocked.body.error).toMatch(/Too many sign-in attempts/);
    expect(blocked.headers['ratelimit-policy']).toBeDefined();
  });
});
