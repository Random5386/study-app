# 15. Testing

## What it is

Automated tests are code that checks your code. They let you change things without fear: if you break something, a test fails before a user notices.

StudyApp has four kinds, following the **testing pyramid** — many fast, small tests at the bottom; a few slow, broad ones at the top:

```
          ▲  End-to-end (Playwright)        a few: real browser, whole app
         ▲▲▲  Component (React Testing Library)  some: one React component
        ▲▲▲▲▲  API / integration (Supertest)   many: real HTTP + real test database
      ▲▲▲▲▲▲▲  Unit (Vitest)                    most: one pure function
```

## Why these tools

| Tool                      | Level                                    | Why                                                                        |
| ------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| **Vitest**                | Runner for unit, API and component tests | Fast, TypeScript out of the box, Jest-compatible API, shares Vite config   |
| **Supertest**             | API tests                                | Sends real HTTP requests to `createApp()` without opening a port           |
| **React Testing Library** | Components                               | Tests what the user sees ("click the button labelled Save"), not internals |
| **Playwright**            | End-to-end                               | Drives a real Chromium browser through the running app                     |
| **FakeAiClient**          | —                                        | Replaces Gemini in tests: free, fast, deterministic, no key needed         |

## Where it lives

```
apps/api/src/**/*.test.ts      # unit tests next to the code (sm2.test.ts, chunkText.test.ts)
apps/api/tests/                # API tests + helpers + globalSetup
apps/web/src/**/*.test.tsx     # component tests
e2e/                           # Playwright specs
```

Commands: `npm test` (all), `npm test -w apps/api -- --watch` (re-run on save), `npx playwright test` (E2E), `npm test -- --coverage`.

## The code, explained

### A unit test — pure function, no setup

```ts
// apps/api/src/lib/chunkText.test.ts
import { describe, expect, it } from 'vitest';
import { chunkText } from './chunkText.js';

describe('chunkText', () => {
  it('keeps short text in one chunk', () => {
    expect(chunkText('Hello\n\nWorld')).toEqual(['Hello\n\nWorld']);
  });

  it('never produces a chunk longer than the limit', () => {
    const text = Array.from({ length: 500 }, (_, i) => `Paragraph ${i} `.repeat(30)).join('\n\n');
    const chunks = chunkText(text, 2_000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(2_000);
  });
});
```

Pattern for every test: **Arrange** (set up input) → **Act** (call the code) → **Assert** (check the result).

See [12](12-flashcards-sm2.md) for the SM-2 unit tests.

### API tests against a real test database

**Setup** — `apps/api/vitest.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

const rootEnv = loadEnv('test', path.resolve(import.meta.dirname, '../..'), '');

export default defineConfig({
  test: {
    env: { ...rootEnv, NODE_ENV: 'test', DATABASE_URL: rootEnv.TEST_DATABASE_URL! }, // never the dev database
    globalSetup: ['./tests/globalSetup.ts'],
    fileParallelism: false, // API tests share one database
  },
});
```

`tests/globalSetup.ts` — wipe and rebuild the test database once per run:

```ts
import { execSync } from 'node:child_process';

export default function setup() {
  execSync('npx prisma migrate reset --force', { stdio: 'inherit', env: process.env });
}
```

**A helper that returns a logged-in "browser"** — `tests/helpers.ts`:

```ts
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { hashPassword } from '../src/lib/passwords.js';

export const app = createApp();
const PASSWORD = 'correct horse battery staple';

export async function loggedInUser() {
  const email = `user-${randomUUID()}@test.dev`;
  await prisma.user.create({
    data: {
      email,
      displayName: 'Test',
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: new Date(),
    },
  });

  const agent = request.agent(app); // keeps cookies between requests, like a browser
  const { body } = await agent.get('/api/auth/csrf');
  const login = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', body.csrfToken)
    .send({ email, password: PASSWORD })
    .expect(200);

  return { agent, csrf: login.body.csrfToken as string }; // login issues a fresh token (page 08)
}
```

**The most important test in the project** — `tests/notes.access.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, loggedInUser } from './helpers.js';

describe('notes access control', () => {
  it("user B cannot read, change or delete user A's note", async () => {
    const a = await loggedInUser();
    const b = await loggedInUser();

    const created = await a.agent
      .post('/api/notes')
      .set('X-CSRF-Token', a.csrf)
      .send({ title: 'A secret' })
      .expect(201);
    const url = `/api/notes/${created.body.id}`;

    await b.agent.get(url).expect(404);
    await b.agent.patch(url).set('X-CSRF-Token', b.csrf).send({ title: 'hacked' }).expect(404);
    await b.agent.delete(url).set('X-CSRF-Token', b.csrf).expect(404);

    const stillThere = await a.agent.get(url).expect(200);
    expect(stillThere.body.title).toBe('A secret');
  });

  it('rejects requests without a session', async () => {
    await request(app).get('/api/notes').expect(401);
  });

  it('rejects changes without a CSRF token', async () => {
    const a = await loggedInUser();
    await a.agent.post('/api/notes').send({ title: 'x' }).expect(403);
  });

  it('rejects invalid input', async () => {
    const a = await loggedInUser();
    const res = await a.agent.post('/api/notes').set('X-CSRF-Token', a.csrf).send({ title: '' }).expect(400);
    expect(res.body.error).toBe('Invalid input');
  });
});
```

Write the same "two users" test for documents, decks and cards. These tests are your proof — in an interview you can say "access control is tested", not just "I think it works".

### Faking things you don't control

- **Gemini:** code takes an `AiClient`; tests pass `new FakeAiClient({ summary: '…', keyTerms: [] })` (page 11) and assert on `fake.calls.length` — e.g. _a cached summary makes zero calls_.
- **The job queue:** routes call `jobs.send(...)`. In API tests, replace that module so no worker is needed:

```ts
import { vi } from 'vitest';
vi.mock('../src/jobs/boss.js', () => ({ jobs: { send: vi.fn() }, startJobWorker: vi.fn() }));
```

Then assert `expect(jobs.send).toHaveBeenCalledWith('extract-text', { documentId: expect.any(String) })`.

### A component test — React Testing Library

```tsx
// apps/web/src/features/study/Flashcard.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { Flashcard } from './Flashcard';

it('shows the answer after flipping', async () => {
  render(<Flashcard front="Capital of Namibia?" back="Windhoek" />);

  expect(screen.queryByText('Windhoek')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /show answer/i }));
  expect(screen.getByText('Windhoek')).toBeInTheDocument();
});
```

Query by **role and visible text** (what users and screen readers see), not CSS classes. If this test is hard to write, the component probably isn't accessible.

### An end-to-end test — Playwright

```ts
// e2e/notes.spec.ts
import { test, expect } from '@playwright/test';

test('demo user creates a note and finds it in the sidebar', async ({ page }) => {
  await page.goto('http://localhost:5173/login');
  await page.getByLabel('Email').fill('demo@studyapp.local');
  await page.getByLabel('Password').fill(process.env.DEMO_PASSWORD!);
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByPlaceholder('Untitled').fill('Photosynthesis');
  await expect(page.getByRole('navigation').getByText('Photosynthesis')).toBeVisible();
});
```

Keep E2E tests few and focused on the critical journeys (log in, create a note, study a deck, upload a document). They're slower and more brittle than the rest.

## What to test (and what not to)

- **Test:** business rules (SM-2, quotas, chunking), access control, validation, error paths, anything that broke before (write a test that reproduces a bug, then fix it).
- **Skip:** library internals (don't test that Prisma saves rows), trivial getters, exact CSS.
- Coverage is a guide, not a goal — 70–80% with meaningful tests beats 100% with shallow ones.

## Common mistakes

- Tests that depend on each other's data or run order.
- Pointing tests at the development database (they'll wipe your work). Ours use `TEST_DATABASE_URL`.
- Calling real external APIs in tests (slow, flaky, costs quota).
- Testing implementation details (state variable names) instead of behaviour.

## Interview questions

**Q: How did you test your project?**
A: A testing pyramid: Vitest unit tests for pure logic like SM-2 and chunking; Supertest API tests against a real Postgres test database, including two-user tests proving access control and CSRF; React Testing Library for components; and a few Playwright end-to-end journeys. External services like Gemini are replaced with fakes through an interface. GitHub Actions runs them on every push.

**Q: What's the difference between unit and integration tests?**
A: A unit test checks one piece in isolation (a function); an integration test checks pieces working together (route + middleware + service + database).

**Q: How do you test code that depends on an external API?**
A: Depend on an interface and inject a fake in tests. It makes tests fast, free and deterministic.

## Try it yourself

1. Write the "two users" access test for decks.
2. Write a test proving the 21st AI request in a day returns 429 (use the FakeAiClient and a user with `aiDailyQuota: 20`).
3. Break `notesService.get` on purpose (remove `userId` from the `where`) and watch the access test fail. Put it back.
