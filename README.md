# StudyApp

> Working name. A full-stack TypeScript study platform: upload study guides, get AI summaries, make flashcards (by hand or with AI), review them with spaced repetition, and take Notion-style notes.

**Status:** Phase 1 of 8. The React app, Express API and PostgreSQL database are set up and talking to each other. Accounts arrive in phase 2.

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
npm run dev              # starts the API (port 3000) and the web app (port 5173)
```

Open **http://localhost:5173**. The dashboard should show two green dots: API running, database connected.

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
| `npm run db:migrate`  | Apply database changes (from phase 2)                  |
| `npm run db:studio`   | Browse the database in your browser                    |
| `npm run db:backup`   | Save a database backup to `backups/`                   |
| `docker compose down` | Stop the database (your data is kept)                  |
| http://localhost:8025 | Mailpit: see emails the app "sends" (from phase 2)     |

### Troubleshooting

- **"Invalid or missing settings in .env"**: run `npm run setup`, then check the setting named in the message.
- **Dashboard says "Database: down"**: start Docker Desktop, then `docker compose up -d`.
- **Port 5432 already in use**: another PostgreSQL is installed on your PC. Stop it, or change the left number in `docker-compose.yml` to `'5433:5432'` and use port 5433 in `.env`.
- **API tests fail with a connection error**: the database must be running (`docker compose up -d`).

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

Passwords hashed with Argon2id, server-side sessions, TOTP multi-factor authentication, CSRF protection, rate limiting and per-user access control tested automatically (from phase 2). Secrets live only in the git-ignored `.env`. The root `package.json` `overrides` pin two patched sub-dependencies of the Prisma CLI so `npm audit` stays clean. See [docs/08-web-security.md](docs/08-web-security.md).
