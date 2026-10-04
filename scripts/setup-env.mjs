// Creates .env from .env.example and fills in random secrets.
// Usage: npm run setup
// Safe to run again: it never changes a value you already have. If .env exists, it only
// adds settings that are new in .env.example (generating secrets for them).
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const EXAMPLE = '.env.example';
const TARGET = '.env';

// Settings that get a random value instead of staying empty.
const generators = {
  SESSION_SECRET: () => randomBytes(48).toString('hex'),
  ENCRYPTION_KEY: () => randomBytes(32).toString('hex'),
  DEMO_PASSWORD: () => `Study-${randomBytes(12).toString('base64url')}`,
};

const exampleLines = readFileSync(EXAMPLE, 'utf8').split(/\r?\n/);
const fill = (line) => {
  const match = line.match(/^([A-Z0-9_]+)=$/);
  const make = match && generators[match[1]];
  return make ? `${match[1]}=${make()}` : line;
};

if (!existsSync(TARGET)) {
  const content = exampleLines.map(fill).join('\n');
  writeFileSync(TARGET, content);
  console.log('Created .env with fresh secrets and a test-account password.');
  finish(content);
} else {
  const current = readFileSync(TARGET, 'utf8');
  const have = new Set([...current.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
  const missing = exampleLines.filter((l) => {
    const name = l.match(/^([A-Z0-9_]+)=/)?.[1];
    return name && !have.has(name);
  });
  if (missing.length === 0) {
    console.log('.env is already up to date; nothing changed.');
  } else {
    const added = missing.map(fill);
    writeFileSync(
      TARGET,
      current.replace(/\s*$/, '\n') + '\n# Added by npm run setup\n' + added.join('\n') + '\n',
    );
    console.log(`Added to .env: ${added.map((l) => l.split('=')[0]).join(', ')}`);
  }
  finish(readFileSync(TARGET, 'utf8'));
}

function finish(text) {
  if (/^GEMINI_API_KEY=\s*$/m.test(text)) {
    console.log(
      '\nNext: paste your free Gemini key into .env as GEMINI_API_KEY=...\n' +
        'Get one at https://aistudio.google.com/apikey (use a project with no billing account).',
    );
  }
}
