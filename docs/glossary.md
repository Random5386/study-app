# Glossary

Short definitions of every term used in this guide. The number in brackets is the page that explains it in context.

| Term                     | Meaning                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **AES-256-GCM**          | A symmetric encryption algorithm that also detects tampering. Used for TOTP secrets. (07)                         |
| **API**                  | Application Programming Interface — here, the set of `/api/...` URLs the React app calls. (01)                    |
| **Argon2id**             | A slow, memory-hard password hashing algorithm; OWASP's first recommendation. (06)                                |
| **Async / await**        | Syntax for waiting on slow operations (Promises) without blocking the server. (02)                                |
| **Audit log**            | A record of security events (logins, MFA changes) for users and developers to review. (08)                        |
| **Backoff**              | Waiting longer between each retry (30 s, 60 s, 120 s…). (10)                                                      |
| **BlockNote**            | The open-source React block editor used for notes. (14)                                                           |
| **Cache**                | A saved result reused instead of recomputing it (e.g. AI summaries). (11)                                         |
| **CI**                   | Continuous Integration — automatic checks on every push (GitHub Actions). (16)                                    |
| **Component**            | A reusable piece of React UI; a function returning JSX. (13)                                                      |
| **Cookie**               | Small data the browser stores and sends back automatically; holds our session id. (01, 06)                        |
| **CORS**                 | A browser rule controlling which origins may read another origin's responses. Not needed here (same origin). (01) |
| **CSP**                  | Content-Security-Policy header: tells the browser which scripts/styles may run. (08)                              |
| **CSRF**                 | Cross-Site Request Forgery — another site making your browser send requests to ours. (08)                         |
| **Dead-letter queue**    | Where jobs go after all retries fail. (10)                                                                        |
| **Debounce**             | Wait until activity pauses, then act once (autosave). (14)                                                        |
| **Dependency inversion** | Code depends on an interface (`AiClient`), not a concrete class, so parts can be swapped. (11)                    |
| **Docker / Compose**     | Runs services (Postgres, Mailpit) in isolated containers from one config file. (03)                               |
| **Environment variable** | A setting supplied from outside the code (`DATABASE_URL`, `GEMINI_API_KEY`). (03)                                 |
| **Express**              | The Node.js web framework for our API. (04)                                                                       |
| **Foreign key**          | A column referencing another table's primary key. (05)                                                            |
| **Hash**                 | One-way function output; can't be reversed. Used for passwords and tokens. (06)                                   |
| **helmet**               | Express middleware that sets security headers. (08)                                                               |
| **HttpOnly**             | Cookie flag: JavaScript can't read the cookie. (06)                                                               |
| **Idempotent**           | Doing it twice has the same effect as once. (10)                                                                  |
| **IDOR**                 | Insecure Direct Object Reference — reaching someone else's data by changing an id. (08)                           |
| **Index (database)**     | A structure that makes lookups fast. (05)                                                                         |
| **JSON**                 | Text format for data exchanged between browser and server. (01)                                                   |
| **JWT**                  | JSON Web Token — a signed, client-held token; an alternative to sessions. (06)                                    |
| **Magic bytes**          | A file's first bytes, which reveal its real type. (09)                                                            |
| **Mailpit**              | A local fake email server and inbox for development. (03, 06)                                                     |
| **Map-reduce**           | Process pieces separately (map), then combine the results (reduce). Used for long documents. (11)                 |
| **MFA / TOTP**           | Multi-factor authentication / time-based one-time passwords (authenticator apps). (07)                            |
| **Middleware**           | A function in Express's request pipeline. (04)                                                                    |
| **Migration**            | A versioned database schema change. (05)                                                                          |
| **Monorepo**             | One repository containing several packages (api, web, shared). (03)                                               |
| **multer**               | Express middleware for file uploads. (09)                                                                         |
| **N+1 problem**          | One query for a list plus one per item; avoided with `include`/`select`. (05)                                     |
| **npm workspaces**       | npm's built-in support for multiple linked packages in one repo. (03)                                             |
| **ORM**                  | Object-Relational Mapper — maps tables to code objects (Prisma). (05)                                             |
| **OWASP Top 10**         | The industry list of the most critical web-app security risks. (08)                                               |
| **pg-boss**              | A job queue stored in PostgreSQL. (10)                                                                            |
| **Prisma**               | The TypeScript ORM we use. (05)                                                                                   |
| **Prompt injection**     | Untrusted text trying to override an AI model's instructions. (11)                                                |
| **Props / State**        | Inputs passed to a component / data a component owns and changes. (13)                                            |
| **Pure function**        | Output depends only on inputs; no side effects. (12)                                                              |
| **Rate limiting**        | Capping how many requests a client can make in a time window. (08)                                                |
| **REST**                 | URL design around resources with HTTP verbs. (01)                                                                 |
| **Salt**                 | Random data mixed into a hash so equal passwords hash differently. (06)                                           |
| **SameSite**             | Cookie flag controlling whether cross-site requests send the cookie. (06, 08)                                     |
| **Session**              | Server-side record that you're logged in, found via a cookie id. (06)                                             |
| **Session fixation**     | Attack that reuses a known session id; prevented by regenerating it at login. (06)                                |
| **SM-2**                 | The classic spaced-repetition scheduling algorithm. (12)                                                          |
| **Soft delete**          | Marking a row deleted (`deletedAt`) instead of removing it, so it can be restored. (14)                           |
| **SPA**                  | Single-page application — one HTML page, React swaps views. (13)                                                  |
| **SQL injection**        | Attacker input changing a database query; prevented by parameterised queries. (05, 08)                            |
| **Status code**          | The number in an HTTP response (200, 404, 500…). (01)                                                             |
| **TanStack Query**       | React library for fetching, caching and updating server data. (13)                                                |
| **Transaction**          | Database changes that all succeed or all fail. (05)                                                               |
| **Type guard**           | A check that narrows a TypeScript type (`ext is AllowedExt`). (09)                                                |
| **UUID v7**              | A unique id that's hard to guess but time-ordered. (05)                                                           |
| **Vite**                 | Front-end dev server and build tool. (13)                                                                         |
| **XSS**                  | Cross-Site Scripting — attacker script running in our pages. (08)                                                 |
| **Zod**                  | Library for runtime validation that also produces TypeScript types. (02)                                          |
