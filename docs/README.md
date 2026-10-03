# StudyApp Learning Guide

This folder explains **every part of StudyApp** — what each piece is, why it was chosen, how the code works, and what an interviewer might ask you about it.

StudyApp is a study app: upload study guides, get AI summaries, make flashcards (by hand or with AI), review them with spaced repetition, and take Notion-style notes. It is built with **TypeScript** end to end:

| Part                                 | Technology                                                |
| ------------------------------------ | --------------------------------------------------------- |
| Front end (what runs in the browser) | React 19 + Vite + TypeScript                              |
| Back end (the server)                | Node.js 24 + Express 5 + TypeScript                       |
| Database                             | PostgreSQL, accessed through Prisma ORM 7                 |
| AI                                   | Google Gemini (free tier) through the `@google/genai` SDK |
| Background jobs                      | pg-boss (a job queue that lives in PostgreSQL)            |

> **How to use this guide:** read the files in order the first time. Later, when you build a feature, re-read its page _before_ you write the code and update the page _after_ — explaining your own code in writing is the fastest way to really understand it, and it is exactly what interviews test.

## Reading order

| #   | File                                                           | You will learn                                                                         |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | [01-how-the-web-works.md](01-how-the-web-works.md)             | Browsers, servers, HTTP, JSON, REST, cookies — and one request traced through StudyApp |
| 2   | [02-typescript-essentials.md](02-typescript-essentials.md)     | The TypeScript you need for this project (and nothing more)                            |
| 3   | [03-project-setup.md](03-project-setup.md)                     | Monorepo, npm scripts, environment variables, Docker, linting                          |
| 4   | [04-express-backend.md](04-express-backend.md)                 | Express app, middleware, routes, services, validation, error handling                  |
| 5   | [05-database-prisma.md](05-database-prisma.md)                 | Relational databases, the Prisma schema, migrations, safe queries                      |
| 6   | [06-authentication-sessions.md](06-authentication-sessions.md) | Password hashing, login, sessions, email verification                                  |
| 7   | [07-mfa-totp.md](07-mfa-totp.md)                               | Multi-factor authentication with authenticator apps                                    |
| 8   | [08-web-security.md](08-web-security.md)                       | OWASP risks and how StudyApp defends against each                                      |
| 9   | [09-file-uploads.md](09-file-uploads.md)                       | Accepting files safely and extracting their text                                       |
| 10  | [10-background-jobs.md](10-background-jobs.md)                 | Why slow work runs in the background, using pg-boss                                    |
| 11  | [11-ai-gemini.md](11-ai-gemini.md)                             | Calling Gemini safely: keys, structured output, caching, quotas                        |
| 12  | [12-flashcards-sm2.md](12-flashcards-sm2.md)                   | Spaced repetition and the SM-2 algorithm                                               |
| 13  | [13-react-frontend.md](13-react-frontend.md)                   | Components, state, routing, data fetching, forms                                       |
| 14  | [14-notes-editor.md](14-notes-editor.md)                       | The Notion-style editor (BlockNote), autosave, nested pages                            |
| 15  | [15-testing.md](15-testing.md)                                 | Unit, API, component and end-to-end tests                                              |
| 16  | [16-git-ci-running.md](16-git-ci-running.md)                   | Git workflow, GitHub Actions, running it locally (and deploying later)                 |
| 17  | [17-interview-prep.md](17-interview-prep.md)                   | Your project pitch, CV bullets and practice questions                                  |
| —   | [glossary.md](glossary.md)                                     | Every term in this guide, in one place                                                 |

## How every page is laid out

Each page follows the same pattern so you always know where to look:

1. **What it is** — plain-English explanation.
2. **Why we use it** — and the alternatives (interviewers love "why X and not Y?").
3. **Where it lives** — the files in the repo.
4. **The code, explained** — real snippets from StudyApp with comments on every important line.
5. **Common mistakes** — what trips beginners up.
6. **Interview questions** — with short model answers. Practise saying them out loud.
7. **Try it yourself** — a small exercise to prove you understand it.

## A note on versions

These pages were written in October 2026 against: Node.js 24 LTS, Express 5, TypeScript 5, Prisma ORM 7 (Prisma 8 was still a release candidate), PostgreSQL 17, React 19, Zod 4, TanStack Query 5, React Router 7, pg-boss 10 or 11 and `@google/genai`. Libraries change — if a snippet doesn't match what you installed, check that library's README and update this guide (that's good practice, not a failure).
