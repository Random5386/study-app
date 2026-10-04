// Settings → Profile, Preferences and "Your data": updating your details, exporting, deleting.
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { lastEmailTo, login, newBrowser, PASSWORD, signedInUser } from './helpers.js';

describe('updating the profile', () => {
  it('changes the display name and returns only public fields', async () => {
    const { browser } = await signedInUser();
    const res = await browser.patch('/api/account/profile', { displayName: '  Thandi  ' }).expect(200);
    expect(res.body.displayName).toBe('Thandi');
    expect(res.body.passwordHash).toBeUndefined();

    const session = await browser.agent.get('/api/auth/session').expect(200);
    expect(session.body.user.displayName).toBe('Thandi');
  });

  it('rejects an empty or too-long name', async () => {
    const { browser } = await signedInUser();
    await browser.patch('/api/account/profile', { displayName: '   ' }).expect(400);
    await browser.patch('/api/account/profile', { displayName: 'x'.repeat(61) }).expect(400);
  });

  it('ignores fields that are not allowed (no mass assignment)', async () => {
    const { browser, email } = await signedInUser();
    await browser
      .patch('/api/account/profile', { displayName: 'Ok', email: 'hacker@evil.dev', aiDailyQuota: 100000 })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.aiDailyQuota).toBe(20);
  });

  it('needs a signed-in user and a CSRF token', async () => {
    const anon = await newBrowser();
    await anon.patch('/api/account/profile', { displayName: 'x' }).expect(401);
    const { browser } = await signedInUser();
    await browser.agent.patch('/api/account/profile').send({ displayName: 'x' }).expect(403);
  });
});

describe('exporting your data', () => {
  it('needs your password and leaves secrets out', async () => {
    const { browser } = await signedInUser();
    await browser.upload('notes.txt', 'Mitochondria make energy for the cell.').expect(201);
    await browser.post('/api/account/export', { password: 'wrong password' }).expect(401);

    const res = await browser.post('/api/account/export', { password: PASSWORD }).expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="studyapp-export-/);
    expect(res.body.documents).toHaveLength(1);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/passwordHash|totpSecret|codeHash|argon2/);
  });
});

describe('deleting the account', () => {
  it('needs the password and the word DELETE', async () => {
    const { browser } = await signedInUser();
    const del = (body: object) =>
      browser.agent.delete('/api/account').set('X-CSRF-Token', browser.csrf).send(body);
    await del({ password: PASSWORD, confirm: 'delete' }).expect(400);
    await del({ password: 'wrong password', confirm: 'DELETE' }).expect(401);
    await browser.agent.get('/api/auth/me').expect(200); // still here
  });

  it('removes the user and everything they own, and signs out every device', async () => {
    const { browser, email } = await signedInUser();
    const { browser: phone } = await login(email);
    await browser.upload('notes.txt', 'Photosynthesis turns light into sugar.').expect(201);
    const { id: userId } = await prisma.user.findUniqueOrThrow({ where: { email } });

    await browser.agent
      .delete('/api/account')
      .set('X-CSRF-Token', browser.csrf)
      .send({ password: PASSWORD, confirm: 'DELETE' })
      .expect(200);

    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await prisma.document.count({ where: { userId } })).toBe(0);
    await browser.agent.get('/api/auth/me').expect(401);
    await phone.agent.get('/api/auth/me').expect(401);
    expect(lastEmailTo(email).subject).toMatch(/was deleted/);
  });
});
