// AI endpoints. Behind requireAuth (see app.ts).
//   GET  /api/documents/:id/summaries   saved summaries, unfinished jobs, and your AI usage
//   POST /api/documents/:id/summaries   ask for a summary { style } → 200 cached, or 202 + a job to poll
//   GET  /api/ai/jobs/:id               poll a job until it's DONE or FAILED
//   GET  /api/ai/usage                  how many AI requests you have left
import { Router } from 'express';
import { z } from 'zod';
import { createSummarySchema } from '@studyapp/shared';
import { aiUsage } from '../../ai/quota.js';
import { currentUserId } from '../../middleware/requireAuth.js';
import { validateBody } from '../../middleware/validate.js';
import { summariesService } from './summaries.service.js';

const idParams = z.object({ id: z.uuid() });

export const documentSummariesRouter = Router({ mergeParams: true }); // mergeParams: see :id from the parent path

documentSummariesRouter.get('/', async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await summariesService.listForDocument(currentUserId(req), id));
});

documentSummariesRouter.post('/', validateBody(createSummarySchema), async (req, res) => {
  const { id } = idParams.parse(req.params);
  const result = await summariesService.request(currentUserId(req), id, req.body.style);
  res.status(result.cached ? 200 : 202).json(result);
});

export const aiRouter = Router();

aiRouter.get('/jobs/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await summariesService.getJob(currentUserId(req), id));
});

aiRouter.get('/usage', async (req, res) => {
  res.json(await aiUsage(currentUserId(req)));
});
