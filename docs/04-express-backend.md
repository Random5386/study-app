# 4. The Express back end

## What it is

**Node.js** lets JavaScript/TypeScript run outside the browser — on a server. **Express** is a small framework on top of Node that answers HTTP requests. You tell Express: "when a `GET` comes in for `/api/notes`, run this function."

## Why we use it

- The most widely used Node web framework; most Node job ads expect you to know it.
- Small and unopinionated, so you learn the real concepts (middleware, routing, error handling) instead of framework magic.
- **Express 5** (current major) automatically catches errors thrown in `async` handlers — Express 4 needed extra wrappers.

Alternatives: **NestJS** (structured, Angular-style, popular in enterprises), **Fastify** (faster, schema-first), **Next.js API routes** (tied to React/Next). Good interview answer: "Express to learn fundamentals; I'd consider NestJS for a large team."

## Where it lives

```
apps/api/src/
├── server.ts            # starts listening on a port
├── app.ts               # builds the app: middleware + routes (no listening → easy to test)
├── middleware/          # functions that run before/after routes
├── modules/<feature>/   # <feature>.routes.ts + <feature>.service.ts
└── lib/httpError.ts     # our error type
```

## The big idea: middleware

A request travels through a **chain of functions**. Each one can look at the request, change it, reply, or call `next()` to pass it on.

```
request → helmet → express.json → session → csrf → requireAuth → route handler → response
                                                        ↓ (anything throws)
                                                  errorHandler → error response
```

A middleware function has this shape:

```ts
(req, res, next) => {
  // look at req, maybe change it
  next(); // pass to the next function
  // or: res.status(401).json(...) to reply and stop the chain
  // or: throw new HttpError(...) to jump to the error handler
};
```

**Order matters.** `express.json()` must come before routes that read `req.body`; `session` must come before `requireAuth`; the error handler must be last.

## The code, explained

### `app.ts` — assembling the app

```ts
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { sessionMiddleware } from './middleware/session.js';
import { csrfProtection } from './middleware/csrf.js';
import { requireAuth } from './middleware/requireAuth.js';
import { errorHandler, apiNotFound } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { notesRouter } from './modules/notes/notes.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { decksRouter } from './modules/decks/decks.routes.js';
import { studyRouter } from './modules/study/study.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // correct client IPs / secure cookies behind a proxy (if deployed)
  app.use(helmet()); // security headers (page 08)
  app.use(express.json({ limit: '1mb' })); // parse JSON bodies, reject huge ones
  app.use(sessionMiddleware); // loads req.session from Postgres (page 06)
  app.use('/api', csrfProtection); // blocks forged requests (page 08)

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter); // public: register, login, ...
  app.use('/api/notes', requireAuth, notesRouter); // everything below needs a login
  app.use('/api/documents', requireAuth, documentsRouter);
  app.use('/api/decks', requireAuth, decksRouter);
  app.use('/api/study', requireAuth, studyRouter);
  app.use('/api', apiNotFound); // unknown /api/... → JSON 404

  // In production, the same server hands out the built React app.
  const webDist = path.resolve(import.meta.dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html')); // let React Router handle /notes, /decks, ...
  });

  app.use(errorHandler); // must be last
  return app;
}
```

- `'/{*splat}'` is Express 5's syntax for "any path, including `/`" (Express 4 used `'*'`).
- `createApp()` returns the app **without** starting it. Tests import it and fire requests at it directly.

### `server.ts` — starting it

```ts
import { createApp } from './app.js';
import { env } from './config/env.js';
import { startJobWorker } from './jobs/boss.js';
import { logger } from './lib/logger.js';

const app = createApp();
await startJobWorker(); // background jobs (page 10)

app.listen(env.PORT, () => {
  logger.info(`${env.APP_NAME} API listening on http://localhost:${env.PORT}`);
});
```

### `lib/httpError.ts` — errors that carry a status code

```ts
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
```

Anywhere in the code: `throw new HttpError(404, 'Note not found')`. The error handler turns it into the right response, so services never touch `res`.

### `middleware/errorHandler.ts` — one place for every error

```ts
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

export const apiNotFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'Not found'));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid input', details: err.issues });
    return;
  }
  // Anything else is a bug: log everything, tell the user nothing sensitive.
  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
};
```

Never send `err.stack` or database messages to the browser — they help attackers. They go to the log instead.

### `middleware/validate.ts` — checking input with Zod

```ts
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body); // throws ZodError → errorHandler → 400
    next();
  };
```

`schema.parse` also **strips unknown fields** (Zod objects do this by default), so a sneaky `"userId": "someone-else"` in the body simply disappears.

### `middleware/requireAuth.ts` — the login gate

```ts
import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/httpError.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) throw new HttpError(401, 'Please log in');
  if (req.session.mfaPending) throw new HttpError(403, 'Finish two-factor sign-in first');
  next();
};

// Helper for handlers: returns the logged-in user's id (requireAuth already guaranteed it).
export function currentUserId(req: Request): string {
  const id = req.session.userId;
  if (!id) throw new HttpError(401, 'Please log in');
  return id;
}
```

### A feature module: notes

**Routes** handle HTTP (read input, call a service, send a response). **Services** hold the business logic and talk to the database. Keeping them apart means services can be reused (e.g. by background jobs) and tested without HTTP.

`modules/notes/notes.routes.ts`

```ts
import { Router } from 'express';
import { z } from 'zod';
import { createNoteSchema, updateNoteSchema } from '@studyapp/shared';
import { validateBody } from '../../middleware/validate.js';
import { currentUserId } from '../../middleware/requireAuth.js';
import { notesService } from './notes.service.js';

export const notesRouter = Router();
const idParams = z.object({ id: z.uuid() });

notesRouter.get('/', async (req, res) => {
  res.json(await notesService.list(currentUserId(req)));
});

notesRouter.get('/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await notesService.get(currentUserId(req), id));
});

notesRouter.post('/', validateBody(createNoteSchema), async (req, res) => {
  const note = await notesService.create(currentUserId(req), req.body);
  res.status(201).json(note);
});

notesRouter.patch('/:id', validateBody(updateNoteSchema), async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await notesService.update(currentUserId(req), id, req.body));
});

notesRouter.delete('/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  await notesService.moveToTrash(currentUserId(req), id);
  res.status(204).end();
});
```

`modules/notes/notes.service.ts`

```ts
import type { CreateNoteInput, UpdateNoteInput } from '@studyapp/shared';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../lib/httpError.js';

export const notesService = {
  list(userId: string) {
    return prisma.note.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        title: true,
        icon: true,
        parentId: true,
        position: true,
        isFavourite: true,
        updatedAt: true,
      },
      orderBy: { position: 'asc' },
    });
  },

  async get(userId: string, id: string) {
    // userId in the WHERE is what stops user A reading user B's note.
    const note = await prisma.note.findFirst({ where: { id, userId, deletedAt: null } });
    if (!note) throw new HttpError(404, 'Note not found');
    return note;
  },

  create(userId: string, input: CreateNoteInput) {
    return prisma.note.create({ data: { ...input, userId } });
  },

  async update(userId: string, id: string, input: UpdateNoteInput) {
    const { count } = await prisma.note.updateMany({
      where: { id, userId, deletedAt: null },
      data: input,
    });
    if (count === 0) throw new HttpError(404, 'Note not found');
    return this.get(userId, id);
  },

  async moveToTrash(userId: string, id: string) {
    const { count } = await prisma.note.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new HttpError(404, 'Note not found');
  },
};
```

Notice: `userId` **always** comes from the session, never from the request body.

## Common mistakes

- Forgetting `await` before a service call → the response is sent before the work finishes, or errors go unhandled.
- Putting database code directly in route handlers → hard to test and reuse.
- Trusting `req.body.userId` → anyone can impersonate anyone.
- Sending two responses (e.g. `res.json()` and then falling through to another `res.json()`) → "Cannot set headers after they are sent".
- Registering the error handler before the routes → it never sees their errors.

## Interview questions

**Q: What is middleware in Express?**
A: A function in the request pipeline with access to `req`, `res` and `next`. It can modify the request, end the response, or pass control on. StudyApp uses middleware for security headers, JSON parsing, sessions, CSRF checks, authentication and error handling.

**Q: How do you handle errors in your API?**
A: Services throw a custom `HttpError` with a status code. Express 5 forwards errors from async handlers to one error-handling middleware, which maps `HttpError` and Zod validation errors to clean JSON responses and logs anything unexpected as a 500 without leaking details.

**Q: Why separate routes and services?**
A: Single responsibility: routes deal with HTTP, services with business rules and data. Services can be reused by background jobs and unit-tested without an HTTP layer.

**Q: How do you stop users accessing each other's data?**
A: The user id comes only from the server-side session, and every query filters by it (`where: { id, userId }`). If nothing matches I return 404. I have API tests proving user A gets 404 for user B's note.

## Try it yourself

Add `GET /api/notes/favourites` that returns only the logged-in user's favourite notes. Put the query in the service, the HTTP code in the routes. **Hint:** register it _before_ `/:id`, otherwise Express will treat `favourites` as an id.
