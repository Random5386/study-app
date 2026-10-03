// Check a request body against a Zod schema. Invalid input → ZodError → 400 (errorHandler).
// Zod also strips fields the schema doesn't list, so a sneaky "userId" in the body disappears.
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    req.body = schema.parse(req.body ?? {});
    next();
  };
