# StudyApp

> Working name. A full-stack TypeScript study platform: upload study guides, get AI summaries, make flashcards (by hand or with AI), review them with spaced repetition, and take Notion-style notes.

**Status:** Phase 3 of 8. Accounts and security (phase 2) and the study guide library (phase 3) are done: upload PDF, Word, text and Markdown study guides, organise them into subjects and tags, and search their text. AI summaries arrive in phase 4.

| Layer     | Technology                                                                 |
| --------- | -------------------------------------------------------------------------- |
| Front end | React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, React Router     |
| Back end  | Node.js 24, Express 5, TypeScript, Zod                                     |
| Database  | PostgreSQL 17 through Prisma ORM 7                                         |
| AI        | Google Gemini (free tier), server-side only                                |
| Quality   | Vitest, Supertest, React Testing Library, ESLint, Prettier, GitHub Actions |

Everything runs locally with free tools. The only online service is the Gemini API, on its free tier.

## Run it on your computer

### 1. Install these once (all free)

- **Node.js 24 LTS**: https://nodejs.org (or `nvm install 24` with nvm-windows)
- **Docker Desktop**: https://www.docker.com/products/docker-desktop/ (runs the database)
- **Git**: https://git-scm.com
- **VS Code** (recommended) with the ESLint, Prettier and Prisma extensions

### 2. Get the code running

```bash
cd study-app
npm install              # installs everything for all three packages
npm run setup            # creates .env with random secrets
```

Open `.env` and paste a free Gemini key after `GEMINI_API_KEY=`. Get one at https://aistudio.google.com/apikey, in a Google project **without** a billing account, so it can never be charged.

```bash
docker compose up -d     # starts PostgreSQL and Mailpit in the background
npm run db:migrate       # creates the database tables
npm run db:seed          # creates the test account (see below)
npm run dev              # starts the API (port 3000) and the web app (port 5173)
```

Open **http://localhost:5173** and create an account. The confirmation email lands in Mailpit at **http://localhost:8025** (nothing is really sent). Click the link, sign in, then open **Study guides** to create a subject and upload a PDF or Word file. Try **Security** in the sidebar to turn on two-factor sign-in with Google or Microsoft Authenticator.

### Everyday commands

| Command               | What it does                                           |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | API + web app with live reload                         |
| `npm test`            | All tests (needs `docker compose up -d` for API tests) |
| `npm run lint`        | Find likely bugs                                       |
| `npm run typecheck`   | TypeScript checks                                      |
| `npm run format`      | Auto-format all files                                  |
| `npm run build`       | Production build                                       |
| `npm start`           | Run the production build on http://localhost:3000      |
| `npm run db:migrate`  | Apply database changes                                 |
| `npm run db:seed`     | Create or reset the test account                       |
| `npm run db:studio`   | Browse the database in your browser                    |
| `npm run db:backup`   | Save a database backup to `backups/`                   |
| `docker compose down` | Stop the database (your data is kept)                  |
| http://localhost:8025 | Mailpit: see emails the app "sends"                    |

### Troubleshooting

- **"Invalid or missing settings in .env"**: run `npm run setup`, then check the setting named in the message.
- **Dashboard says "Database: down"**: start Docker Desktop, then `docker compose up -d`.
- **Port 5432 already in use**: another PostgreSQL is installed on your PC. Stop it, or change the left number in `docker-compose.yml` to `'5433:5432'` and use port 5433 in `.env`.
- **API tests fail with a connection error**: the database must be running (`docker compose up -d`).
- **"The table `User` does not exist"**: run `npm run db:migrate`.
- **No email arrived**: open Mailpit at http://localhost:8025. If registering shows "Something went wrong", Mailpit isn't running: `docker compose up -d`.

## Test account

`npm run db:seed` creates a ready-to-use account with sample subjects and study guides:

- **Email:** the `DEMO_EMAIL` value in `.env` (default `demo@studyapp.local`)
- **Password:** the `DEMO_PASSWORD` value in `.env` (`npm run setup` generates one)

Run `npm run db:seed` again any time to reset it: it restores the password, unlocks the account and turns two-factor sign-in off. Your own uploads in that account are kept. The password only lives in your git-ignored `.env`.

## Project layout

```text
study-app/
├── apps/api/          Express back end (TypeScript)
├── apps/web/          React front end (Vite)
├── packages/shared/   Zod schemas used by both
├── docs/              Learning guide: how every part works, and interview questions
├── docker-compose.yml PostgreSQL + Mailpit for local development
└── .github/workflows/ CI: lint, type-check, test and build on every push
```

## Learning guide

`docs/` explains every component: what it is, why it was chosen, annotated code, common mistakes and interview questions. Start with [docs/README.md](docs/README.md).

## Security

- Passwords hashed with **Argon2id**; new passwords checked against the Pwned Passwords breach list (k-anonymity, only 5 hash characters leave the server)
- **Server-side sessions** in PostgreSQL with `HttpOnly`, `SameSite=Strict` cookies; a new session id at every sign-in (no session fixation)
- **TOTP two-factor sign-in** with AES-256-GCM-encrypted secrets, replay protection and 10 hashed one-time recovery codes
- **CSRF tokens** on every change; **rate limits** and a 15-minute **account lock** after 5 wrong passwords
- No account enumeration: sign-up and password reset give the same answer whether or not an email exists
- **Active sessions** page with remote sign-out, and a **security history** of every sign-in and change
- Uploads are checked by their real contents (magic bytes), limited to 5 MB each and 50 MB per user, stored in the database (never a public folder) and always downloaded as attachments
- 52 API tests prove these rules, including that one user can't touch another user's sessions or documents Secrets live only in the git-ignored `.env`. The root `package.json` `overrides` pin two patched sub-dependencies of the Prisma CLI so `npm audit` stays clean. See [docs/08-web-security.md](docs/08-web-security.md).
