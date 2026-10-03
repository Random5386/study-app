# 1. How the web works (and how StudyApp uses it)

## What it is

Every web app is a conversation between two programs:

- The **client** — the browser running StudyApp's React code on the user's computer.
- The **server** — StudyApp's Node.js + Express program. While you develop it runs on your own PC at `http://localhost:3000`; if you deploy later, it runs on a hosting company's machine instead.

They talk using **HTTP**: the client sends a **request**, the server sends back a **response**. That is the whole model. Everything else is detail.

```
Browser (React)  ── HTTP request ──▶  Express server  ──▶  PostgreSQL
                 ◀── HTTP response ──                 ◀──
```

## The parts of an HTTP request

```http
POST /api/notes HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Cookie: studyapp.sid=s%3Aabc123...
X-CSRF-Token: 9f2c...

{"title": "Photosynthesis", "subjectId": "0192f..."}
```

| Part    | Example                  | Meaning                                    |
| ------- | ------------------------ | ------------------------------------------ |
| Method  | `POST`                   | What you want to do (see table below)      |
| Path    | `/api/notes`             | Which resource                             |
| Headers | `Content-Type`, `Cookie` | Extra information about the request        |
| Body    | `{"title": ...}`         | The data you're sending (JSON in StudyApp) |

### Methods (verbs)

| Method   | Use in StudyApp                        | Example                                   |
| -------- | -------------------------------------- | ----------------------------------------- |
| `GET`    | Read something. Must not change data.  | `GET /api/notes` — list my notes          |
| `POST`   | Create something, or trigger an action | `POST /api/notes`, `POST /api/auth/login` |
| `PATCH`  | Change part of something               | `PATCH /api/notes/:id` — rename a note    |
| `DELETE` | Remove something                       | `DELETE /api/notes/:id`                   |

### Status codes (the server's answer in one number)

| Code                      | Meaning                        | When StudyApp sends it                |
| ------------------------- | ------------------------------ | ------------------------------------- |
| 200 OK                    | Worked, here's data            | Fetching notes                        |
| 201 Created               | Worked, something new exists   | Creating a note                       |
| 204 No Content            | Worked, nothing to return      | Deleting a note                       |
| 400 Bad Request           | Your input is invalid          | Title is empty                        |
| 401 Unauthorized          | You're not logged in           | No session cookie                     |
| 403 Forbidden             | Logged in, but not allowed     | Missing CSRF token, MFA not completed |
| 404 Not Found             | Doesn't exist (or isn't yours) | Note belongs to someone else          |
| 409 Conflict              | Clashes with existing data     | Email already registered              |
| 429 Too Many Requests     | Slow down                      | Too many login attempts               |
| 500 Internal Server Error | Bug on our side                | Unexpected exception                  |

> **Why 404 and not 403 for someone else's note?** A 403 would confirm the note exists. Returning 404 leaks nothing. This is a nice detail to mention in interviews.

## JSON

JSON (JavaScript Object Notation) is the text format the client and server use for data:

```json
{ "id": "0192f3...", "title": "Photosynthesis", "isFavourite": false, "tags": ["biology"] }
```

In Express, `express.json()` turns incoming JSON text into a JavaScript object (`req.body`), and `res.json(obj)` turns an object back into JSON text.

## REST

**REST** is a style of designing URLs around _resources_ (nouns) and using HTTP methods as the verbs:

```
GET    /api/decks              list decks
POST   /api/decks              create a deck
GET    /api/decks/:id          one deck
PATCH  /api/decks/:id          update a deck
DELETE /api/decks/:id          delete a deck
GET    /api/decks/:id/cards    cards in a deck
```

`:id` is a **route parameter** — Express puts its value in `req.params.id`.

## Cookies and sessions (how the server remembers you)

HTTP is **stateless**: each request is independent, and the server doesn't automatically know two requests came from the same person. StudyApp solves this with a **session cookie**:

1. You log in. The server creates a _session_ (a row in the `session` table) holding `{ userId: "..." }`.
2. The server sends back `Set-Cookie: studyapp.sid=<random id>; HttpOnly; Secure; SameSite=Strict`.
3. The browser automatically attaches that cookie to every later request to the same site.
4. The server looks up the session by its id and knows who you are.

The cookie only holds a random id — never your password or user data. Page [06](06-authentication-sessions.md) covers this in depth.

## Same origin

An **origin** is scheme + host + port, e.g. `http://localhost:3000` (or `https://studyapp.example.com` once deployed). StudyApp's Express server serves _both_ the API (`/api/...`) and the React files (`/`, `/notes`, ...) from one origin. Benefits:

- No **CORS** configuration needed (CORS is the browser rule that blocks one origin from reading responses from another).
- Cookies are first-party, so `SameSite=Strict` works and browsers don't block them.

During development Vite runs the React app on port 5173 and **proxies** `/api` requests to Express on port 3000, so the browser still sees one origin.

## One request, traced end to end: "save a note"

1. You type in the editor. After 1 second of no typing, React calls `api.patch('/api/notes/0192f...', { content })`.
2. Our `api.ts` wrapper adds the `X-CSRF-Token` header and sends the request. The browser adds the session cookie.
3. **Express middleware** runs in order: `helmet` adds security headers → `express.json()` parses the body → `session` loads your session from Postgres → `csrfProtection` checks the token → `requireAuth` checks you're logged in.
4. The **route** `PATCH /api/notes/:id` runs `validate(updateNoteSchema)`, which rejects bad input with 400.
5. The route calls the **service** `notesService.update(userId, noteId, data)`.
6. The service uses **Prisma** to run `UPDATE "Note" SET ... WHERE id = $1 AND "userId" = $2`. If no row matched, it throws `HttpError(404)`.
7. Express sends `200` with the updated note as JSON.
8. React's TanStack Query updates its cache, and the "Saved" indicator appears.

If anything throws along the way, the **error handler** middleware turns it into a clean JSON error response.

## Common mistakes

- Using `GET` for something that changes data (browsers and proxies may repeat or cache GETs).
- Returning 200 with `{ "error": "..." }` instead of a proper status code.
- Thinking the client can be trusted. **Anything from the browser can be faked** — always validate on the server.

## Interview questions

**Q: What happens when you type a URL into a browser and press Enter?**
A: The browser resolves the domain to an IP address via DNS, opens a TCP connection (and a TLS handshake for HTTPS), sends an HTTP GET request, the server responds with HTML, and the browser parses it, downloads the CSS/JS it references, and renders the page. In StudyApp, the JS is our React app, which then calls our `/api` endpoints for data.

**Q: What's the difference between PUT and PATCH?**
A: PUT replaces the whole resource; PATCH changes only the fields you send. StudyApp uses PATCH because the editor usually sends just one field.

**Q: Why is HTTP called stateless, and how do you keep a user logged in?**
A: Each request carries everything the server needs; the server keeps no memory between requests by default. We add state with a session: a random session id in an HttpOnly cookie that maps to session data stored server-side in Postgres.

## Try it yourself

Once the API runs, open your browser's DevTools → **Network** tab, save a note, and click the request. Find the method, status code, request headers (spot the cookie and CSRF header), request body and response body.
