import { z } from 'zod';

/** Shape of GET /api/health. The API builds it; the web app checks it. */
export const healthResponseSchema = z.object({
  ok: z.boolean(),
  app: z.string(),
  database: z.enum(['up', 'down']),
  time: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
