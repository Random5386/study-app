import path from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Read the repo-root .env (if there is one), then force the TEST database
// so tests can never touch your development data. In CI, the workflow supplies these values.
const rootEnv = loadEnv('test', path.resolve(import.meta.dirname, '../..'), '');
const merged = { ...rootEnv, ...process.env };

export default defineConfig({
  resolve: {
    conditions: ['development'], // use @studyapp/shared's TypeScript source directly
  },
  test: {
    env: {
      ...merged,
      NODE_ENV: 'test',
      DATABASE_URL: merged.TEST_DATABASE_URL ?? '',
    },
    fileParallelism: false, // API tests share one database
  },
});
