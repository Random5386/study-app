# 16. Git, CI and running the app

## What it is

- **Git** records every change to the code, so you can see history, undo mistakes and work on features in isolation.
- **GitHub** hosts the repository publicly — this is what recruiters will look at.
- **CI (Continuous Integration)** automatically runs lint, type-checks and tests on every push, so broken code is caught immediately. We use **GitHub Actions** (free for public repos).
- **Git hooks** (via Husky) run quick checks on your PC _before_ a commit is even created.

## Why it matters for your first job

Recruiters and interviewers open your GitHub. A clean history of small, well-described commits, pull requests, a green CI badge and a good README signal "this person already works like a professional developer" — often more than the features themselves.

## A professional Git workflow (even when working alone)

1. `main` always works. Never commit half-finished work straight to it.
2. For each piece of work, create a branch: `git switch -c feat/notes-autosave`.
3. Commit small, logical steps with **Conventional Commit** messages:

   | Prefix      | Use for                          | Example                                                  |
   | ----------- | -------------------------------- | -------------------------------------------------------- |
   | `feat:`     | New feature                      | `feat(notes): autosave after 1s of inactivity`           |
   | `fix:`      | Bug fix                          | `fix(auth): regenerate session after MFA`                |
   | `test:`     | Tests only                       | `test(notes): prove users can't read each other's notes` |
   | `docs:`     | Documentation                    | `docs: explain SM-2 in learning guide`                   |
   | `refactor:` | Restructure, no behaviour change | `refactor(api): move quota check into service`           |
   | `chore:`    | Tooling, dependencies            | `chore: bump prisma to 7.x`                              |

4. Push and open a **pull request** (PR) on GitHub. Write what changed and why, add a screenshot for UI changes, and review your own diff line by line.
5. Wait for CI to go green, then **squash and merge**. Delete the branch.

On GitHub, turn on **branch protection** for `main` (require PRs and passing checks), **secret scanning** and **push protection**, and **Dependabot** alerts.

## The code, explained

### Pre-commit checks — Husky + lint-staged

`npm install` runs `husky` (the `prepare` script), which installs the hook. `.husky/pre-commit`:

```bash
npx lint-staged
```

`package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,css}": "prettier --write"
}
```

Only the files you're committing are checked, so it takes seconds.

### CI — `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: # a throwaway Postgres just for this run
        image: postgres:17
        env:
          POSTGRES_USER: studyapp
          POSTGRES_PASSWORD: studyapp_ci
          POSTGRES_DB: studyapp_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U studyapp"
          --health-interval 5s --health-timeout 5s --health-retries 10
    env: # CI-only values; nothing here is a real secret
      NODE_ENV: test
      APP_URL: http://localhost:5173
      DATABASE_URL: postgresql://studyapp:studyapp_ci@localhost:5432/studyapp_test
      TEST_DATABASE_URL: postgresql://studyapp:studyapp_ci@localhost:5432/studyapp_test
      SESSION_SECRET: ci-only-session-secret-at-least-32-characters
      ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000'
      GEMINI_API_KEY: not-used-tests-use-a-fake
      GEMINI_MODEL: fake
      GEMINI_FALLBACK_MODEL: fake
      SMTP_HOST: localhost
      SMTP_PORT: 1025
      AI_DAILY_QUOTA: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci # clean install from package-lock.json (also runs `prisma generate` via postinstall)
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm audit --audit-level=high

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # scan the whole history
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Add a CI badge to the README: `![CI](https://github.com/<you>/study-app/actions/workflows/ci.yml/badge.svg)`.

## Running StudyApp locally (everything free)

### Daily commands

| Command                | Does                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| `docker compose up -d` | Start PostgreSQL + Mailpit                                              |
| `npm run dev`          | API on http://localhost:3000, web on http://localhost:5173 (hot reload) |
| `npm run db:migrate`   | Apply new migrations                                                    |
| `npm run db:seed`      | Create the demo account and sample data                                 |
| `npm run db:studio`    | Browse the database in Prisma Studio                                    |
| http://localhost:8025  | Mailpit inbox (verification and reset emails)                           |
| `npm test`             | All tests                                                               |
| `npm run db:backup`    | Save a database backup to `backups/`                                    |

### The demo account — `apps/api/prisma/seed.ts` (shape)

```ts
const email = 'demo@studyapp.local';
const password = process.env.DEMO_PASSWORD ?? 'StudyApp-demo-2026!'; // local-only demo password

await prisma.user.upsert({
  where: { email },
  update: {},
  create: {
    email,
    displayName: 'Demo Student',
    passwordHash: await hashPassword(password),
    emailVerifiedAt: new Date(),
    decks: { create: [{ name: 'Biology — Cells', cards: { create: sampleCards } }] },
    notes: { create: [{ title: 'Welcome to StudyApp', content: welcomeBlocks }] },
  },
});
```

`upsert` makes the seed safe to run more than once (idempotent again — page 10).

### Backups — `scripts/backup.mjs`

```js
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dump = execFileSync(
  'docker',
  ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', 'studyapp', 'studyapp'],
  {
    maxBuffer: 512 * 1024 * 1024,
  },
);
writeFileSync(`backups/studyapp-${stamp}.sql`, dump);
console.log(`Backup written to backups/studyapp-${stamp}.sql`);
```

Restore (Git Bash): `docker compose exec -T db psql -U studyapp studyapp < backups/<file>.sql`. In PowerShell: `Get-Content backups\<file>.sql | docker compose exec -T db psql -U studyapp studyapp`.

## Showing it to recruiters without hosting

- **README**: one-paragraph pitch, screenshots/GIFs of each feature, the architecture diagram, "Run it in 5 minutes" steps, a security section, and a link to this learning guide.
- **Demo video** (2–3 minutes, free tools: OBS Studio or Windows Snipping Tool's recorder): register → MFA → upload → summary → AI flashcards → study session → notes.
- **Pinned repo** on your GitHub profile; link it on your CV and LinkedIn.

## Deploying later (optional)

The app is designed to go online unchanged: Express serves the React build from one address, files live in Postgres, and settings come from environment variables. In October 2026, Render's free web service and Neon's free Postgres (no card) could host it for R0, with the trade-off that free apps sleep when idle. The steps would be: create a Neon database, set `DATABASE_URL` and the other variables in Render's dashboard, use `npm ci && npm run build` as the build command, run `prisma migrate deploy` before start, and start with `node apps/api/dist/server.js`. Check each host's docs at the time, because free tiers change.

## Common mistakes

- Giant commits named "updates" or "final final v2".
- Committing `.env`, `node_modules/` or build output.
- Ignoring a red CI build ("it works on my machine").
- `git push --force` on `main`.

## Interview questions

**Q: Describe your Git workflow.**
A: Feature branches, small conventional commits, a pull request per feature with a self-review, CI must pass, then squash-merge into a protected `main`.

**Q: What does your CI pipeline do?**
A: On every push and PR it installs with `npm ci`, lints, type-checks, runs unit and API tests against a throwaway Postgres service, audits dependencies, and scans history for leaked secrets with gitleaks.

**Q: How would someone run your project?**
A: Clone, `npm install`, copy `.env.example` to `.env` and add a Gemini key, `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`. Everything else is free and local.

## Try it yourself

1. Create a branch, make a tiny change, commit with a conventional message, push, open a PR and watch CI run.
2. Break a test on purpose in a PR and see the red ❌ block the merge (with branch protection on).
3. Run `npm run db:backup`, delete a note, restore the backup and see the note come back.
