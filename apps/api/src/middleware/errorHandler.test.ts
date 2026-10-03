// Unit tests: the error handler on its own, with tiny fake req/res objects.
import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import { errorHandler } from './errorHandler.js';

function fakeResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); // allow res.status(...).json(...)
  return res;
}

const req = { method: 'GET', path: '/x' } as Request;
const next: NextFunction = vi.fn();

describe('errorHandler', () => {
  it('uses the status and message of an HttpError', () => {
    const res = fakeResponse();
    errorHandler(new HttpError(404, 'Note not found'), req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Note not found', details: undefined });
  });

  it('turns Zod validation errors into 400 with details', () => {
    const res = fakeResponse();
    const result = z.object({ title: z.string().min(1) }).safeParse({ title: '' });
    if (result.success) throw new Error('expected validation to fail');

    errorHandler(result.error, req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Invalid input' }));
  });

  it('hides the details of unexpected errors', () => {
    const res = fakeResponse();
    errorHandler(new Error('database password is hunter2'), req, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
  });
});
