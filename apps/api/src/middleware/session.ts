// Server-side sessions stored in PostgreSQL. The browser only holds a random,
// signed session id in an HttpOnly cookie. See docs/06-authentication-sessions.md.
import connectPgSimple from 'connect-pg-simple';
import type { Request } from 'express';
import session from 'express-session';
import { env } from '../config/env.js';

// Tell TypeScript what we keep in a session.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    mfaPending?: boolean; // true between the password step and the MFA code
    csrfToken?: string; // see middleware/csrf.ts
    lastSeenAt?: number; // when we last updated the "active sessions" row
  }
}

export const SESSION_COOKIE = 'studyapp.sid';
const TWO_HOURS = 2 * 60 * 60 * 1000;

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({
    conString: env.DATABASE_URL,
    tableName: 'session', // created by our Prisma migration
    createTableIfMissing: false,
    pruneSessionInterval: env.NODE_ENV === 'test' ? false : 15 * 60, // delete expired rows every 15 min
  }),
  name: SESSION_COOKIE, // don't advertise the default "connect.sid"
  secret: env.SESSION_SECRET, // signs the cookie so it can't be tampered with
  resave: false, // don't rewrite unchanged sessions
  saveUninitialized: false, // don't create sessions for visitors until something is stored
  rolling: true, // each request pushes the expiry forward
  cookie: {
    httpOnly: true, // page JavaScript can't read it (limits XSS damage)
    secure: env.NODE_ENV === 'production', // HTTPS-only once deployed (localhost is plain HTTP)
    sameSite: 'strict', // never sent on requests started by other sites (CSRF defence)
    maxAge: TWO_HOURS, // signed out after 2 hours of inactivity
  },
});

// express-session uses callbacks; these wrappers let us `await` them.

/** Give the session a brand-new id (call on every login and privilege change). */
export const regenerateSession = (req: Request) =>
  new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));

export const destroySession = (req: Request) =>
  new Promise<void>((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));

/** Save now, so the new id exists in the database before we respond. */
export const saveSession = (req: Request) =>
  new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
