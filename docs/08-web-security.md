# 8. Web security: the OWASP Top 10 in practice

## What it is

The **OWASP Top 10** is the industry's list of the most critical web-app security risks. Knowing it — and being able to point at the code that defends against each one — is one of the strongest things a junior developer can show in an interview.

## How StudyApp maps to the OWASP Top 10

| OWASP risk                         | What it means                              | StudyApp's defence                                                                                  | Page       |
| ---------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ---------- |
| A01 Broken access control          | Users reaching data/actions they shouldn't | `requireAuth`; every query filters by `userId`; 404 for other users' items; tests prove it          | 04, 05, 15 |
| A02 Cryptographic failures         | Weak or missing crypto                     | Argon2id passwords; AES-256-GCM TOTP secrets; hashed tokens; HTTPS + HSTS when deployed             | 06, 07     |
| A03 Injection                      | SQL/command injection                      | Prisma parameterised queries; tagged `$queryRaw`; no `exec` of user input                           | 05         |
| A04 Insecure design                | Missing security thinking up front         | Threat list in the plan; MFA; quotas; least privilege                                               | plan       |
| A05 Security misconfiguration      | Unsafe defaults, verbose errors            | helmet headers; generic 500 messages; `x-powered-by` removed; env validated at start                | 03, 04     |
| A06 Vulnerable components          | Outdated libraries                         | `npm audit` in CI; Dependabot pull requests                                                         | 16         |
| A07 Identification & auth failures | Weak login/session handling                | Rate limits, lockout, session regeneration, HttpOnly/SameSite cookies, breached-password check, MFA | 06, 07     |
| A08 Software & data integrity      | Untrusted code/data                        | `package-lock.json`; AI output validated with Zod and never executed                                | 11         |
| A09 Logging & monitoring failures  | Attacks go unnoticed                       | `AuditLog` table; structured pino logs with secrets redacted                                        | below      |
| A10 Server-side request forgery    | Server tricked into calling internal URLs  | The server only calls fixed hosts (Gemini, Pwned Passwords); no "fetch this URL" feature            | —          |

## The code, explained

### Security headers with helmet

```ts
app.use(helmet());
```

One line sets a dozen headers. The important ones:

| Header                            | Protects against                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`         | XSS: the browser only runs scripts from our own origin, no inline scripts                                  |
| `Strict-Transport-Security`       | Downgrade to HTTP (only meaningful once served over HTTPS)                                                 |
| `X-Frame-Options: SAMEORIGIN`     | Clickjacking: other sites can't embed StudyApp in an invisible frame (we still embed our own PDF previews) |
| `X-Content-Type-Options: nosniff` | Browsers "guessing" an uploaded file is HTML/JS                                                            |
| `Referrer-Policy: no-referrer`    | Leaking URLs to other sites                                                                                |

Check them yourself: DevTools → Network → click any request → Response Headers.

### CSRF protection (synchronizer token)

**CSRF (Cross-Site Request Forgery):** an evil page makes _your_ browser send a request to StudyApp. The browser attaches your cookie automatically, so without protection the request would run as you.

Two layers:

1. `sameSite: 'strict'` on the session cookie — modern browsers won't send it on requests started by other sites.
2. A **secret token per session** that our React app must send in a header. Another site can't read it, so it can't forge it.

```ts
// middleware/csrf.ts
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function issueCsrfToken(req: Request): string {
  req.session.csrfToken = randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next(); // reads don't change data, so no token needed
  const expected = req.session.csrfToken;
  const sent = req.get('x-csrf-token');
  if (!expected || !sent || !safeEqual(expected, sent)) {
    throw new HttpError(403, 'Invalid or missing CSRF token');
  }
  next();
};

// Compare in constant time so response timing doesn't leak how many characters matched.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
```

```ts
// auth.routes.ts — the React app calls this once on start-up
authRouter.get('/csrf', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken ?? issueCsrfToken(req) });
});
```

`session.regenerate()` at login creates a fresh session, so the login route issues a new token (`issueCsrfToken(req)`) and returns it in the response; the front end swaps it in (page 13).

### Rate limiting

```ts
// middleware/rateLimits.ts
import { rateLimit } from 'express-rate-limit';

const base = { standardHeaders: 'draft-7', legacyHeaders: false } as const;

export const loginLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 5,
  message: { error: 'Too many attempts. Try again in a minute.' },
});
export const mfaLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 5,
  message: { error: 'Too many codes. Try again in a minute.' },
});
export const aiLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 10,
  message: { error: 'Slow down a little.' },
});
```

These limit by IP address. The per-user daily AI quota (page 11) is enforced separately in the database.

### Access control (IDOR)

**IDOR (Insecure Direct Object Reference):** changing `/api/notes/abc` to `/api/notes/xyz` and seeing someone else's note. Defences in StudyApp:

- `userId` comes only from `req.session`, never from the request.
- Every service query includes it: `where: { id, userId }` or `where: { id, deck: { userId } }`.
- Not found and not yours look identical (404).
- UUID v7 ids can't be guessed by counting.
- An API test logs in as two users and proves each gets 404 for the other's data (page 15).

### XSS (Cross-Site Scripting)

XSS = an attacker's JavaScript running in _your_ page (e.g. a note titled `<script>steal()</script>`).

- React escapes everything rendered with `{value}` — it shows the text, it doesn't run it.
- We never use `dangerouslySetInnerHTML`.
- Notes are stored as BlockNote **JSON**, not HTML, and rendered by the editor's own schema.
- AI output is treated as plain text.
- The CSP header blocks inline and third-party scripts as a backstop.
- The session cookie is `HttpOnly`, so even if XSS happened, the script couldn't read it.

### Safe logging

```ts
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      '*.password',
      '*.passwordHash',
      '*.apiKey',
      '*.code',
    ],
    censor: '[redacted]',
  },
});
```

Plus an **audit log** in the database for security events (`Login`, `FailedLogin`, `MfaEnabled`, `PasswordChanged`, ...), shown to users on a "Security history" page so they can spot activity that wasn't them.

### Secrets

Covered in [03](03-project-setup.md) and [11](11-ai-gemini.md): `.env` is git-ignored, settings are validated at start-up, the Gemini key is only used server-side, and GitHub push protection + gitleaks catch accidents.

## Common mistakes

- Checking "is logged in" but not "owns this item" — the most common real-world bug.
- Returning detailed errors (stack traces, SQL) to the browser.
- Thinking HTTPS alone makes an app secure.
- Disabling CSP because "something broke" instead of fixing the cause.

## Interview questions

**Q: What's the difference between XSS and CSRF?**
A: XSS runs an attacker's script _inside_ our site; CSRF makes the victim's browser send a request _to_ our site from another site. XSS is stopped by escaping output and CSP; CSRF by SameSite cookies and a per-session token.

**Q: Walk me through how you secured your app.**
A: Use the OWASP table above: pick three (access control, auth, injection) and describe the code and the tests that prove it.

**Q: What's IDOR?**
A: Accessing another user's object by changing an id. I scope every query to the session's user id, return 404 for anything not owned, and test it with two users.

**Q: Why compare tokens with `timingSafeEqual`?**
A: A normal string comparison stops at the first wrong character, so response time can leak how much of a guess was right. A constant-time comparison always takes the same time.

## Try it yourself

1. In DevTools Console, run `fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"title":"x"}' })`. You should get 403 (no CSRF token).
2. Create a note titled `<img src=x onerror=alert(1)>`. Confirm it shows as text and no alert appears.
3. Log in as the demo user, copy a note's URL, log in as a second user in a private window and open it. Expect "not found".
