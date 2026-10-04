// `npm run db:seed`: creates or resets the test account described in .env (DEMO_EMAIL / DEMO_PASSWORD).
import { prisma } from '../src/db/prisma.js';
import { seedDemoAccount } from '../src/dev/seedDemo.js';

const email = process.env.DEMO_EMAIL ?? 'demo@studyapp.local';
const password = process.env.DEMO_PASSWORD;

if (!password || password.length < 12) {
  console.error(
    'DEMO_PASSWORD is missing or shorter than 12 characters. Run `npm run setup` to add one to .env.',
  );
  process.exit(1);
}

try {
  const result = await seedDemoAccount({ email, password });
  console.log(
    `${result.createdAccount ? 'Created' : 'Reset'} the test account ${email}` +
      (result.addedSampleData ? ' and added sample subjects and documents.' : '.'),
  );
  console.log('The password is DEMO_PASSWORD in your .env file. Two-factor sign-in is off.');
} finally {
  await prisma.$disconnect();
}
