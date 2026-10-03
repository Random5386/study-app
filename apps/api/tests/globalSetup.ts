// Runs once before all API tests: brings the TEST database up to date and empties it.
// It never touches your development database. See docs/15-testing.md.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';

const apiDir = path.resolve(import.meta.dirname, '..');

export default async function setup() {
  config({ path: path.resolve(apiDir, '../../.env'), quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');

  // Apply any migrations the test database doesn't have yet.
  // TEST_SKIP_MIGRATE=1 is only for machines that can't download Prisma's engine.
  if (!process.env.TEST_SKIP_MIGRATE) {
    execSync('npx prisma migrate deploy', {
      cwd: apiDir,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: url },
    });
  }

  // Start every run from empty tables (CASCADE also empties tables that point at User).
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('TRUNCATE "User", "session" CASCADE');
  await client.end();
}
