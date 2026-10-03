// API tests: real HTTP requests against the real app and the TEST database.
// See docs/15-testing.md.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@studyapp/shared';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('reports the API and database as up', async () => {
    const res = await request(app).get('/api/health').expect(200);

    // The response must match the shared schema the web app relies on.
    const body = healthResponseSchema.parse(res.body);
    expect(body).toMatchObject({ ok: true, database: 'up' });
  });

  it('sends security headers from helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('error handling', () => {
  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/does-not-exist').expect(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken": ')
      .expect(400);
    expect(res.body).toEqual({ error: 'Malformed request body' });
  });
});
