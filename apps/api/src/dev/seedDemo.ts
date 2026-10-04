// Creates (or resets) a test account with sample study material, for trying the app by hand.
// Run it with `npm run db:seed`. The email and password come from DEMO_EMAIL / DEMO_PASSWORD in .env.
//
// Running it again is safe (idempotent): it resets the password, confirms the email, unlocks the
// account and turns two-factor sign-in off, so the stored credentials always work. Sample subjects
// and documents are only added when the account has none, so your own uploads are never touched.
import { createHash } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { hashPassword } from '../lib/passwords.js';
import { countWords } from '../modules/documents/textExtraction.js';
import { SAMPLE_DOCUMENTS, SAMPLE_SUBJECTS } from './sampleContent.js';

export type SeedOptions = { email: string; password: string; displayName?: string };
export type SeedResult = { userId: string; createdAccount: boolean; addedSampleData: boolean };

export async function seedDemoAccount({
  email,
  password,
  displayName = 'Demo Student',
}: SeedOptions): Promise<SeedResult> {
  const normalisedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email: normalisedEmail }, select: { id: true } });

  const user = await prisma.user.upsert({
    where: { email: normalisedEmail },
    create: { email: normalisedEmail, displayName, passwordHash, emailVerifiedAt: new Date() },
    update: {
      passwordHash,
      emailVerifiedAt: new Date(),
      failedLogins: 0,
      lockedUntil: null,
      mfaEnabledAt: null,
      totpSecretEnc: null,
      totpLastStep: null,
    },
  });
  await prisma.recoveryCode.deleteMany({ where: { userId: user.id } }); // MFA is off, so these are useless

  const [subjects, documents] = await Promise.all([
    prisma.subject.count({ where: { userId: user.id } }),
    prisma.document.count({ where: { userId: user.id } }),
  ]);
  const addSamples = subjects === 0 && documents === 0;

  if (addSamples) {
    const subjectIds = new Map<string, string>();
    for (const [position, s] of SAMPLE_SUBJECTS.entries()) {
      const row = await prisma.subject.create({
        data: { userId: user.id, name: s.name, colour: s.colour, position },
      });
      subjectIds.set(s.name, row.id);
    }

    for (const doc of SAMPLE_DOCUMENTS) {
      const bytes = Buffer.from(doc.content, 'utf8');
      await prisma.document.create({
        data: {
          userId: user.id,
          subjectId: doc.subject ? (subjectIds.get(doc.subject) ?? null) : null,
          title: doc.title,
          originalName: doc.fileName,
          mimeType: doc.fileName.endsWith('.md') ? 'text/markdown' : 'text/plain',
          sizeBytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
          status: 'READY', // text files need no extraction job
          extractedText: doc.content,
          wordCount: countWords(doc.content),
          file: { create: { bytes: new Uint8Array(bytes) } },
          tags: {
            create: doc.tags.map((name) => ({
              tag: {
                connectOrCreate: {
                  where: { userId_name: { userId: user.id, name } },
                  create: { userId: user.id, name },
                },
              },
            })),
          },
        },
      });
    }
  }

  return { userId: user.id, createdAccount: !existing, addedSampleData: addSamples };
}
