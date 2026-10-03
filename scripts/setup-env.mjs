// Creates .env from .env.example and fills in random secrets.
// Usage: npm run setup
// Safe to run again: it never overwrites an existing .env.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const EXAMPLE = '.env.example';
const TARGET = '.env';

if (existsSync(TARGET)) {
  console.log('.env already exists, leaving it unchanged.');
  checkGeminiKey(readFileSync(TARGET, 'utf8'));
  process.exit(0);
}

const secrets = {
  SESSION_SECRET: randomBytes(48).toString('hex'),
  ENCRYPTION_KEY: randomBytes(32).toString('hex'),
};

let content = readFileSync(EXAMPLE, 'utf8');
for (const [name, value] of Object.entries(secrets)) {
  // Replace an empty "NAME=" line with "NAME=<random value>"
  content = content.replace(new RegExp(`^${name}=$`, 'm'), `${name}=${value}`);
}

writeFileSync(TARGET, content);
console.log('Created .env with fresh SESSION_SECRET and ENCRYPTION_KEY.');
checkGeminiKey(content);

function checkGeminiKey(text) {
  if (/^GEMINI_API_KEY=\s*$/m.test(text)) {
    console.log(
      '\nNext: paste your free Gemini key into .env as GEMINI_API_KEY=...\n' +
        'Get one at https://aistudio.google.com/apikey (use a project with no billing account).',
    );
  }
}
