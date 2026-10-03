// Prisma 7 settings: where the schema and migrations live, and which database to use.
import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` (run on every npm install) doesn't need a database,
    // so a missing .env shouldn't break installs. Migrations do need the real URL.
    url: process.env.DATABASE_URL ?? '',
  },
});
