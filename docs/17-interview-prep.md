# 17. Interview prep: talking about StudyApp

Building the project is half the job. The other half is explaining it clearly, honestly and confidently. Use this page once features are built — and only claim what you actually built and understand.

## Your 60-second pitch

> "StudyApp is a full-stack study platform I built in TypeScript. Students upload study guides, get AI summaries from Google Gemini, generate flashcards — by AI or by hand — review them with the SM-2 spaced-repetition algorithm, and take Notion-style notes.
>
> The back end is Node.js and Express with PostgreSQL through Prisma; the front end is React with TanStack Query. I focused on security: Argon2 password hashing, server-side sessions, TOTP multi-factor authentication with encrypted secrets, CSRF protection, rate limiting, and per-user access control that I prove with automated tests.
>
> AI calls run in a Postgres-backed job queue with retries, results are cached and validated against schemas, and each user has a daily quota, so the whole thing runs on Gemini's free tier. It's tested with Vitest, Supertest and Playwright, and CI runs on every push. It's a rebuild of a college group project — this time I designed and built every part myself."

Practise it out loud until it takes 60 seconds without reading.

## CV bullet points (edit to match what you finished)

- Built **StudyApp**, a full-stack TypeScript study platform (React, Node.js/Express, PostgreSQL/Prisma) with AI document summaries, AI-generated flashcards, spaced-repetition review and a Notion-style block editor.
- Implemented secure authentication: Argon2id hashing, server-side sessions, TOTP MFA with AES-256-GCM-encrypted secrets and recovery codes, CSRF tokens, rate limiting and audit logging, mapped to the OWASP Top 10.
- Integrated the Google Gemini API through a background job queue (pg-boss) with schema-validated JSON output, caching, retries and per-user quotas, keeping AI costs at R0.
- Wrote unit, API and end-to-end tests (Vitest, Supertest, Playwright) including multi-user access-control tests; automated lint, type-check, tests and secret scanning with GitHub Actions.

Link the repo and the demo video right under the project title.

## STAR stories to prepare

Interviewers often ask "tell me about a challenge". Use **S**ituation, **T**ask, **A**ction, **R**esult. Prepare three from your real experience building it; here are the shapes:

**1. Keeping AI free and reliable**

- _S:_ Gemini's free tier has rate limits, and calls take seconds and sometimes fail.
- _T:_ Make AI features feel reliable without paying.
- _A:_ Moved calls into a pg-boss job queue with retries and backoff and a fallback model; cached results per document, style and prompt version; added a per-user daily quota; requested JSON with a schema and validated it with Zod.
- _R:_ No repeated calls for the same document, failed calls recover automatically, and the user sees clear progress. (Add a real number: e.g. "the second summary request returns in under 50 ms from cache".)

**2. Proving users can't see each other's data**

- _S:_ Every feature stores per-user data.
- _T:_ Guarantee isolation, not just hope for it.
- _A:_ User id only from the session, every query scoped by it, 404 for anything not owned, and "two users" API tests for every resource.
- _R:_ A test fails if anyone ever forgets the `userId` filter. (Mention if a test actually caught a bug — that's a great story.)

**3. Autosave in the notes editor**

- _S:_ Saving on every keystroke flooded the API.
- _A:_ Debounced saves, a "Saving…/Saved" indicator from the mutation state, and a flush when leaving the page.
- _R:_ One request per pause instead of dozens per sentence.

## Questions you should be able to answer (with where to revise)

| Question                                                       | Page                                |
| -------------------------------------------------------------- | ----------------------------------- |
| Walk me through what happens when a user saves a note.         | [01](01-how-the-web-works.md)       |
| Why TypeScript? `any` vs `unknown`?                            | [02](02-typescript-essentials.md)   |
| How do you manage secrets?                                     | [03](03-project-setup.md)           |
| What is middleware? How do you handle errors in Express?       | [04](04-express-backend.md)         |
| What's an index? A transaction? The N+1 problem?               | [05](05-database-prisma.md)         |
| How do you store passwords? Sessions vs JWT? Session fixation? | [06](06-authentication-sessions.md) |
| How does TOTP work? How do you store the secret?               | [07](07-mfa-totp.md)                |
| XSS vs CSRF? What is IDOR? Name OWASP Top 10 items.            | [08](08-web-security.md)            |
| How do you handle file uploads securely?                       | [09](09-file-uploads.md)            |
| Why a job queue? What is idempotency?                          | [10](10-background-jobs.md)         |
| How did you integrate AI safely? Prompt injection?             | [11](11-ai-gemini.md)               |
| Explain an algorithm you implemented.                          | [12](12-flashcards-sm2.md)          |
| Props vs state? How do you fetch data in React?                | [13](13-react-frontend.md)          |
| Flat list → tree: how and what's the complexity?               | [14](14-notes-editor.md)            |
| How did you test it? Unit vs integration?                      | [15](15-testing.md)                 |
| Describe your Git workflow and CI.                             | [16](16-git-ci-running.md)          |

## "What would you do differently / next?"

Have honest, specific answers ready:

- Real-time updates with Server-Sent Events instead of polling job status.
- FSRS instead of SM-2 for better scheduling.
- Object storage (S3/Azure Blob) for files if usage grew.
- Passkeys (WebAuthn) as a phishing-resistant login option.
- Observability: request ids in logs, metrics and alerts once deployed.
- Accessibility audit with a screen reader and axe.

## "This was a group project before — what did you do?"

Be clear and honest: the original StudySync (PHP/MySQL) was a group project; this rebuild (StudyApp) is your own design and code, with a new stack and new features. Say what you learned from the first version that changed your design (e.g. "we stored the API key in the front end last time; this time it never leaves the server").

## Live demo checklist

- [ ] `docker compose up -d` and `npm run dev` running **before** the call; demo account seeded.
- [ ] A short sample PDF ready to upload; a summary already cached as a backup if Gemini is slow.
- [ ] Mailpit open in a tab; an authenticator app with the demo account added.
- [ ] Code open in VS Code at: `app.ts`, `notes.service.ts`, `sm2.ts`, `geminiClient.ts`, the access-control test.
- [ ] Close other tabs and notifications.

## Questions to ask them

- "What does onboarding look like for a junior developer here?"
- "How do code reviews work on the team?"
- "What does a typical first project look like?"
- "Which parts of your stack would I work in most?"

## Try it yourself

Record yourself giving the 60-second pitch and answering three random questions from the table. Watch it back, note where you hesitated, and re-read that page.
