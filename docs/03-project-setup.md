# 3. Project setup: monorepo, scripts, environment, Docker

## What it is

Before any feature exists, a project needs a skeleton: where code lives, how to install and run it, where secrets go, and how the database starts. StudyApp keeps everything in **one Git repository** (a _monorepo_) with three packages.

```
study-app/
├── apps/api/          # Express back end      (package name: @studyapp/api)
├── apps/web/          # React front end        (package name: @studyapp/web)
├── packages/shared/   # Zod schemas both use   (package name: @studyapp/shared)
├── docker/init.sql    # creates the test database on first start
├── docker-compose.yml # PostgreSQL + Mailpit
├── .env.example       # list of settings, no real values
└── package.json       # the workspace root
```

## Why we use it

- **One repo** = one clone, one `npm install`, one pull request for a change that touches front and back end.
- **npm workspaces** (built into npm, free) link the packages together, so `apps/web` can `import { createNoteSchema } from '@studyapp/shared'`.
- **Docker** runs PostgreSQL and Mailpit without installing them on Windows directly, and gives every developer the same versions.

Alternatives: two separate repos (simpler per repo, but duplicated types); Turborepo/Nx (faster builds for big monorepos — overkill here).

## The root `package.json`

A simplified version (the real file also has `setup`, `format`, `db:*` and `lint-staged` settings):

```json
{
  "name": "study-app",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently -n api,web -c blue,magenta \"npm run dev -w apps/api\" \"npm run dev -w apps/web\"",
    "build": "npm run build -w packages/shared && npm run build -w apps/web && npm run build -w apps/api",
    "lint": "eslint .",
    "format": "prettier --write .",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "db:migrate": "npm run db:migrate -w apps/api",
    "db:seed": "npm run db:seed -w apps/api",
    "db:studio": "npm run db:studio -w apps/api",
    "db:backup": "node scripts/backup.mjs",
    "prepare": "husky"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "typescript": "^5.6.0"
  }
}
```

What each line does:

- `"private": true` — stops you accidentally publishing the project to the npm registry.
- `"workspaces"` — tells npm every folder under `apps/` and `packages/` is a package to link.
- `-w apps/api` — "run this script inside that workspace".
- `concurrently` — runs the API and web dev servers side by side in one terminal (works on Windows, unlike `&`).
- `"prepare": "husky"` — runs automatically after `npm install` and sets up the git hooks (see [16](16-git-ci-running.md)).

The `^` in `"^9.0.0"` means "any 9.x version" — npm records the exact versions it installed in `package-lock.json`, which **is** committed so everyone gets identical installs.

## TypeScript configuration

A shared `tsconfig.base.json` at the root, extended by each package:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  }
}
```

- `strict` — the full set of safety checks (see [02](02-typescript-essentials.md)).
- `noUncheckedIndexedAccess` — `array[0]` is typed as `T | undefined`, forcing you to handle empty arrays.
- `module: NodeNext` — use modern ES modules (`import`/`export`) the way Node.js 24 understands them.

The web app overrides `module`/`moduleResolution` to `ESNext`/`Bundler` because Vite, not Node, resolves its imports.

## Environment variables and secrets

Settings that differ between machines — database address, secret keys, the Gemini key — are **environment variables**, never hard-coded.

`.env.example` (committed — names only):

```bash
APP_NAME=StudyApp
APP_URL=http://localhost:5173
PORT=3000
DATABASE_URL=postgresql://studyapp:studyapp_dev_password@localhost:5432/studyapp
TEST_DATABASE_URL=postgresql://studyapp:studyapp_dev_password@localhost:5432/studyapp_test
SESSION_SECRET=            # run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
ENCRYPTION_KEY=            # 64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GEMINI_API_KEY=            # from Google AI Studio, in a project with NO billing account
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODEL=gemini-3.8-flash
SMTP_HOST=localhost
SMTP_PORT=1025
AI_DAILY_QUOTA=20
```

`.env` (never committed — your real values). `.gitignore` contains:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
backups/
coverage/
```

### Validating settings at start-up: `apps/api/src/config/env.ts`

```ts
import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

// Load the .env file from the repo root (four folders up from this file).
config({ path: path.resolve(import.meta.dirname, '../../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('StudyApp'),
  APP_URL: z.url(),
  PORT: z.coerce.number().int().default(3000), // env vars are strings; coerce turns "3000" into 3000
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/), // 32 bytes as hex, for AES-256-GCM
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string(),
  GEMINI_FALLBACK_MODEL: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int(),
  AI_DAILY_QUOTA: z.coerce.number().int().positive(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a clear message now beats a confusing crash later.
  console.error('❌ Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data; // fully typed: env.PORT is a number
```

Every other file imports `env` from here instead of reading `process.env` directly. Benefits: one place to see every setting, typos caught at start-up, and correct types.

## Docker: `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: studyapp
      POSTGRES_PASSWORD: studyapp_dev_password # local-only password; never reuse it anywhere real
      POSTGRES_DB: studyapp
    ports:
      - '5432:5432' # host port : container port
    volumes:
      - db-data:/var/lib/postgresql/data # keeps data when the container restarts
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U studyapp']
      interval: 5s

  mailpit:
    image: axllent/mailpit
    ports:
      - '1025:1025' # SMTP: the app sends email here
      - '8025:8025' # web inbox: open http://localhost:8025

volumes:
  db-data:
```

`docker/init.sql` runs once, on the very first start:

```sql
CREATE DATABASE studyapp_test;  -- a separate database the tests can wipe freely
```

Commands you'll use:

| Command                  | Does                                         |
| ------------------------ | -------------------------------------------- |
| `docker compose up -d`   | Start Postgres and Mailpit in the background |
| `docker compose ps`      | See what's running                           |
| `docker compose logs db` | Read the database logs                       |
| `docker compose down`    | Stop them (data is kept in the volume)       |
| `docker compose down -v` | Stop **and delete all data** — careful       |

## Code style: ESLint and Prettier

- **Prettier** formats code (spacing, quotes, line breaks) so nobody argues about style.
- **ESLint** finds likely bugs (unused variables, floating promises, `any`). We use `typescript-eslint`'s recommended rules plus `eslint-plugin-react-hooks` for the web app.
- **Husky + lint-staged** run both on the files you're committing, so badly formatted code never reaches the repo.

## First-time setup (what the README will say)

```bash
git clone https://github.com/<you>/study-app.git
cd study-app
npm install
npm run setup                 # creates .env with random secrets; then paste in your Gemini key
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev                   # API on :3000, web on :5173
```

## Common mistakes

- Committing `.env`. If it ever happens: **rotate the key immediately** (create a new one and delete the old one in AI Studio); deleting the file in a later commit does not remove it from Git history.
- Reading `process.env.X` all over the code — typos become silent `undefined`s.
- Running two copies of Postgres (Docker and a Windows install) on port 5432. Stop one, or map Docker to `5433:5432`.

## Interview questions

**Q: How do you manage secrets in your project?**
A: They live in environment variables loaded from a git-ignored `.env` file locally. A committed `.env.example` documents the names. At start-up I validate them with Zod so the app fails fast with a clear message. GitHub push protection and a gitleaks pre-commit hook stop accidental commits.

**Q: Why Docker for the database?**
A: Same Postgres version for everyone, no manual install, easy reset, and it mirrors how the database would run in production.

**Q: What is `package-lock.json` for?**
A: It records the exact version of every installed package, so every install — mine, CI's, a teammate's — is identical.

## Try it yourself

Delete `GEMINI_API_KEY` from your `.env` and start the API. Read the error. Put it back. Then add a new setting `MAX_UPLOAD_MB` with a default of 5 to the schema and use it in the upload code.
