# 6. Authentication: passwords, login and sessions

> **In the real code (phase 2):** see `apps/api/src/modules/auth/` and `apps/api/src/middleware/session.ts`. Compared with the snippets below, it also has `GET /api/auth/session` (always 200, so a signed-out visitor sees no red console errors), a login rate limit per IP + email, `signOutEverywhere()` after a password reset or change, and a `testOutbox` in `lib/mailer.ts` so tests can read emailed links. The tests in `apps/api/tests/auth.test.ts` prove each rule.

## What it is

- **Authentication** = proving _who_ you are (email + password, then MFA).
- **Authorisation** = deciding _what_ you're allowed to do (only your own notes).
- A **session** = the server remembering that you've already authenticated.

StudyApp's flow:

```
Register → verification email (Mailpit) → click link → Log in (email + password)
        → [if MFA on] enter 6-digit code (page 07) → session marked fully signed in
```

## Why we use these tools

| Tool                | Job                        | Why this one                                                                                                                                        |
| ------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `argon2`            | Hash passwords             | Argon2id won the Password Hashing Competition and is OWASP's first choice; it's deliberately slow and memory-hungry, which makes guessing expensive |
| `express-session`   | Session handling           | The standard Express session library                                                                                                                |
| `connect-pg-simple` | Store sessions in Postgres | No Redis needed; sessions survive server restarts                                                                                                   |
| `nodemailer`        | Send email                 | Talks to any SMTP server — locally that's Mailpit                                                                                                   |

**Sessions vs JWTs (a classic interview question):** a JWT is a signed token the _browser_ holds; the server keeps no record. That's handy for many separate services or mobile apps, but logging out or revoking a stolen token is hard. StudyApp is one server on one origin, so **server-side sessions** are simpler and safer: logout deletes the row, and "log out other devices" is one query.

## Where it lives

```
apps/api/src/
├── middleware/session.ts
├── modules/auth/auth.routes.ts
├── modules/auth/auth.service.ts
├── lib/passwords.ts      # hashing + breached-password check
├── lib/tokens.ts         # email verification / reset tokens
└── lib/mailer.ts
```

## Password hashing, explained

You **never** store passwords. You store a **hash**: the output of a one-way function. At login you hash what the user typed and compare.

- **Salt**: random bytes mixed in per user, so two people with the same password get different hashes and pre-computed "rainbow tables" are useless. Argon2 adds the salt automatically and stores it inside the hash string.
- **Slow on purpose**: a fast hash (MD5, SHA-256) lets attackers try billions of guesses per second on a stolen database. Argon2id makes each guess cost time _and_ memory.

```ts
// lib/passwords.ts
import argon2 from 'argon2';
import { createHash } from 'node:crypto';

export const hashPassword = (plain: string) => argon2.hash(plain); // argon2id is the default
export const verifyPassword = (hash: string, plain: string) => argon2.verify(hash, plain);

/**
 * Has this password appeared in a known data breach?
 * Uses the free Pwned Passwords "range" API with k-anonymity:
 * only the first 5 characters of the SHA-1 hash ever leave our server.
 */
export async function isBreachedPassword(plain: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(plain).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split('\n').some((line) => {
      const [hash, count] = line.trim().split(':');
      return hash === suffix && Number(count) > 0; // padding rows have count 0
    });
  } catch {
    return false; // "fail open": if the service is down, don't block sign-ups
  }
}
```

(SHA-1 is fine _here_ because it's only a lookup key for the breach list, not how we store passwords.)

## Sessions, explained

### `middleware/session.ts`

```ts
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { env } from '../config/env.js';

// Tell TypeScript what we keep in a session.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    mfaPending?: boolean; // true between password and MFA code
    csrfToken?: string; // page 08
  }
}

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({ conString: env.DATABASE_URL, tableName: 'session' }),
  name: 'studyapp.sid', // cookie name (don't advertise the default "connect.sid")
  secret: env.SESSION_SECRET, // signs the cookie so it can't be tampered with
  resave: false, // don't rewrite unchanged sessions
  saveUninitialized: false, // don't create sessions for anonymous visitors
  rolling: true, // each request pushes the expiry forward
  cookie: {
    httpOnly: true, // JavaScript in the page can't read it (limits XSS damage)
    secure: env.NODE_ENV === 'production', // HTTPS-only once deployed (localhost is plain HTTP)
    sameSite: 'strict', // never sent on requests started by other sites (CSRF defence)
    maxAge: 2 * 60 * 60 * 1000, // 2 hours of inactivity
  },
});
```

**Gotcha:** connect-pg-simple's `session` table isn't created by Prisma, and Prisma would treat an unknown table as "drift". So we declare it in `schema.prisma` and let migrations create it:

```prisma
model session {
  sid    String   @id @db.VarChar
  sess   Json     @db.Json
  expire DateTime @db.Timestamp(6)

  @@index([expire], map: "IDX_session_expire")
}
```

### Promisified helpers

`express-session` uses callbacks; these wrappers let us `await` them:

```ts
import type { Request } from 'express';

export const regenerateSession = (req: Request) =>
  new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));

export const destroySession = (req: Request) =>
  new Promise<void>((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));
```

## Registration and email verification

```ts
// modules/auth/auth.service.ts (excerpt)
import { Prisma } from '../../generated/prisma/client.js';

async register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();

  if (await isBreachedPassword(input.password)) {
    throw new HttpError(400, 'This password has appeared in a data breach. Please choose a different one.');
  }

  try {
    const user = await prisma.user.create({
      data: { email, displayName: input.displayName, passwordHash: await hashPassword(input.password) },
    });
    await sendVerificationEmail(user);
  } catch (err) {
    // P2002 = unique constraint failed → email already registered.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await sendAlreadyRegisteredEmail(email); // tell the real owner, tell the requester nothing
      return;
    }
    throw err;
  }
}
```

The route always answers **"Check your inbox to continue"**, whether or not the email existed. Otherwise an attacker could use the sign-up form to discover who has an account (**account enumeration**).

### One-time tokens (`lib/tokens.ts`)

```ts
import { randomBytes, createHash } from 'node:crypto';

export function createToken() {
  const raw = randomBytes(32).toString('base64url'); // goes in the emailed link
  const hash = createHash('sha256').update(raw).digest('hex'); // only this is stored
  return { raw, hash };
}
export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');
```

Store `{ userId, type: 'EmailVerify', tokenHash: hash, expiresAt: now + 24h }` in `AuthToken`. When the link is clicked, hash the token from the URL, find a matching unused, unexpired row, mark it used and set `emailVerifiedAt`. Because only hashes are stored, a database leak doesn't hand out working links. Password-reset tokens work the same way, with a 30-minute expiry.

### Sending email locally (`lib/mailer.ts`)

```ts
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: false });

export function sendMail(to: string, subject: string, text: string) {
  return transporter.sendMail({ from: `"${env.APP_NAME}" <no-reply@studyapp.local>`, to, subject, text });
}
```

Open **http://localhost:8025** — Mailpit shows every email the app "sent". Nothing leaves your PC.

## Login

```ts
// auth.service.ts (excerpt)
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

async login(emailInput: string, password: string) {
  const email = emailInput.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const invalid = new HttpError(401, 'Email or password is incorrect'); // same message either way

  if (!user) {
    await hashPassword(password); // spend the same time as a real check, so timing doesn't reveal accounts
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, 'Too many attempts. Try again in a few minutes.');
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: failed >= LOCK_AFTER
        ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
        : { failedLogins: failed },
    });
    await audit(user.id, 'FailedLogin');
    throw invalid;
  }
  if (!user.emailVerifiedAt) throw new HttpError(403, 'Please verify your email first');

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  return user;
}
```

```ts
// auth.routes.ts (excerpt)
authRouter.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const user = await authService.login(req.body.email, req.body.password);

  await regenerateSession(req); // brand-new session id → stops "session fixation"
  req.session.userId = user.id;
  req.session.mfaPending = user.mfaEnabledAt !== null; // must still pass MFA (page 07)
  await authService.recordLoginSession(user.id, req); // for "active sessions"
  await audit(user.id, 'Login', req.ip);

  res.json({
    mfaRequired: req.session.mfaPending,
    user: toPublicUser(user),
    csrfToken: issueCsrfToken(req), // the old token died with the old session (page 08)
  });
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(req);
  res.clearCookie('studyapp.sid');
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(toPublicUser(await authService.getUser(currentUserId(req))));
});
```

`toPublicUser` picks only safe fields (`id`, `email`, `displayName`, `mfaEnabled`) — **never** send `passwordHash` or `totpSecretEnc` to the browser.

**Session fixation** (why `regenerate`): if an attacker can plant a known session id in your browser before you log in, and the id doesn't change at login, they now share your logged-in session. A fresh id at every privilege change defeats this.

## "Active sessions" and "log out other devices"

At login we insert a `LoginSession` row: `{ userId, sid: req.sessionID, ipAddress, userAgent }`. The settings page lists them. "Log out other devices":

```ts
const others = await prisma.loginSession.findMany({ where: { userId, NOT: { sid: req.sessionID } } });
const sids = others.map((s) => s.sid);
await prisma.$transaction([
  prisma.session.deleteMany({ where: { sid: { in: sids } } }), // their cookies stop working instantly
  prisma.loginSession.deleteMany({ where: { sid: { in: sids } } }),
]);
```

## Common mistakes

- Different error messages for "no such email" vs "wrong password" (account enumeration).
- Hashing with SHA-256/MD5, or writing your own hashing.
- Storing session data in a JWT in `localStorage` (readable by any XSS).
- Forgetting `regenerate` on login.
- Logging request bodies (they contain passwords). Our logger redacts `password` fields.

## Interview questions

**Q: How do you store passwords?**
A: Hashed with Argon2id, which salts automatically and is deliberately slow and memory-hard. I also reject passwords found in breach lists using the Pwned Passwords k-anonymity API.

**Q: Sessions or JWT — which did you use and why?**
A: Server-side sessions stored in Postgres, with an HttpOnly, SameSite=Strict cookie. It's one server on one origin, so I didn't need stateless tokens, and sessions are easy to revoke — logout and "log out other devices" just delete rows.

**Q: What's session fixation and how do you prevent it?**
A: An attacker gets you to use a session id they know, then rides it after you log in. I call `session.regenerate()` on login and after MFA so the id always changes when privileges change.

**Q: How do you prevent brute-force login attempts?**
A: Rate limiting per IP on the login route, plus a 15-minute account lock after five failures, both logged to an audit table. The error message is identical for unknown emails and wrong passwords.

## Try it yourself

1. Register, then open Mailpit and find the verification email. Click the link.
2. Open Prisma Studio → `session` table. Log in and watch a row appear; log out and watch it disappear.
3. Enter a wrong password five times and confirm the lock message, then check `AuditLog`.
