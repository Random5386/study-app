// One place that turns every error into a clean JSON response.
// Registered LAST in app.ts so it sees errors from every route.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

/** Unknown /api/... paths get a JSON 404 instead of the React app's HTML. */
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

  // Malformed JSON body, or a body bigger than express.json's limit.
  if (isBodyParserError(err)) {
    res
      .status(err.status)
      .json({ error: err.status === 413 ? 'Request is too large' : 'Malformed request body' });
    return;
  }

  // Anything else is a bug: log the details, tell the user nothing sensitive.
  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Something went wrong' });
};

function isBodyParserError(err: unknown): err is { status: 400 | 413; type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    'status' in err &&
    (err.status === 400 || err.status === 413)
  );
}
