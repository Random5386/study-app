// The test-account seed: creates a working account once, and resets it safely when run again.
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { seedDemoAccount } from '../src/dev/seedDemo.js';
import { SAMPLE_DOCUMENTS } from '../src/dev/sampleContent.js';
import { login, uniqueEmail } from './helpers.js';

describe('seedDemoAccount', () => {
  it('creates a verified account with sample data that can sign in', async () => {
    const email = uniqueEmail();
    const result = await seedDemoAccount({ email, password: 'first test password' });
    expect(result).toMatchObject({ createdAccount: true, addedSampleData: true });

    const { browser, body } = await login(email, 'first test password');
    expect(body.mfaRequired).toBe(false);
    const docs = await browser.agent.get('/api/documents').expect(200);
    expect(docs.body).toHaveLength(SAMPLE_DOCUMENTS.length);
    expect(docs.body.every((d: { status: string }) => d.status === 'READY')).toBe(true);
    const exam = await browser.agent.get('/api/documents?tag=exam').expect(200);
    expect(exam.body).toHaveLength(2);
  });

  it("running again resets the password and MFA but keeps the user's own data", async () => {
    const email = uniqueEmail();
    const { userId } = await seedDemoAccount({ email, password: 'first test password' });
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabledAt: new Date(), totpSecretEnc: 'x', lockedUntil: new Date(Date.now() + 60_000) },
    });

    const again = await seedDemoAccount({ email, password: 'second test password' });
    expect(again).toMatchObject({ createdAccount: false, addedSampleData: false });
    expect(await prisma.document.count({ where: { userId } })).toBe(SAMPLE_DOCUMENTS.length); // no duplicates

    const { body } = await login(email, 'second test password'); // new password, unlocked, no MFA
    expect(body.mfaRequired).toBe(false);
  });
});
