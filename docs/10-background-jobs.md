# 10. Background jobs with pg-boss

> **In the real code (phase 3):** see `apps/api/src/jobs/queue.ts`. pg-boss 12 is used; its handlers receive a batch (array) of jobs. Phase 3 has one queue, `extract-text`, with 2 retries and a dead-letter queue that marks the document FAILED. In tests, `useInlineJobs()` runs each job immediately inside the request, so an upload is fully processed when the test's request returns. The AI queues (`summarise`, `generate-flashcards`) arrive in phases 4–5.

## What it is

Some work is **slow**: extracting text from a 100-page PDF, or waiting 5–20 seconds for Gemini. If the API did that inside the request, the user would stare at a spinner, requests could time out, and the server would hold resources the whole time.

Instead, the request **puts a job in a queue** and answers immediately ("got it, working on it"). A **worker** picks jobs off the queue and does them in the background. The browser checks back for the result.

```
POST /api/documents/:id/summaries ──▶ create AiJob row ──▶ queue "summarise" ──▶ 202 Accepted { jobId }
                                                              │
                                     worker ◀─────────────────┘
                                       └─▶ calls Gemini ─▶ saves Summary ─▶ AiJob status = DONE
GET /api/jobs/:jobId  (every 2 s) ──▶ { status: 'RUNNING' } … { status: 'DONE', resultId }
```

## Why pg-boss

- The queue lives in **PostgreSQL**, which we already run — no Redis, no extra service, R0.
- Jobs survive restarts: if the server stops mid-job, the job is still in the table and is picked up again.
- Built-in **retries with backoff**, **dead-letter queues**, scheduling (cron) and throttling.

Alternatives: **BullMQ** (very popular, needs Redis), cloud queues (AWS SQS, Azure Service Bus — cost money), or a plain `setTimeout` (loses work on restart — don't).

## Where it lives

```
apps/api/src/jobs/
├── boss.ts                 # creates queues, starts workers
├── extractText.job.ts      # page 09
├── summarise.job.ts        # page 11
└── generateFlashcards.job.ts
```

## The code, explained

### `jobs/boss.ts`

```ts
// pg-boss 11+ uses a named export. On pg-boss 10 write: import PgBoss from 'pg-boss';
import { PgBoss } from 'pg-boss';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { handleExtractText } from './extractText.job.js';
import { handleSummarise, markAiJobFailed } from './summarise.job.js';
import { handleGenerateFlashcards } from './generateFlashcards.job.js';

const boss = new PgBoss(env.DATABASE_URL); // creates its own "pgboss" schema; Prisma ignores it
boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));

const aiRetry = { retryLimit: 3, retryDelay: 30, retryBackoff: true }; // 30 s, then ~60 s, then ~120 s

export async function startJobWorker() {
  await boss.start();

  await boss.createQueue('extract-text', { retryLimit: 2 });
  await boss.createQueue('ai-failed'); // dead-letter queue
  await boss.createQueue('summarise', { ...aiRetry, deadLetter: 'ai-failed' });
  await boss.createQueue('generate-flashcards', { ...aiRetry, deadLetter: 'ai-failed' });

  // Each handler receives a batch (array) of jobs; batchSize: 1 = one at a time.
  await boss.work<{ documentId: string }>('extract-text', async (jobs) => {
    for (const job of jobs) await handleExtractText(job.data);
  });
  await boss.work<{ aiJobId: string }>('summarise', { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await handleSummarise(job.data);
  });
  await boss.work<{ aiJobId: string }>('generate-flashcards', { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) await handleGenerateFlashcards(job.data);
  });
  // Jobs that used up all retries land here, so we can tell the user.
  await boss.work<{ aiJobId: string }>('ai-failed', async (jobs) => {
    for (const job of jobs) await markAiJobFailed(job.data.aiJobId);
  });
}

export const jobs = {
  send: <T extends object>(queue: string, data: T) => boss.send(queue, data),
};
```

How it behaves:

- **Throw** inside a handler → pg-boss marks that attempt failed and schedules a retry.
- **Return normally** → the job is completed.
- After the last retry fails → the job moves to the `ai-failed` **dead-letter queue**.
- `batchSize: 1` on the AI queues means one Gemini call at a time per worker, which keeps us under the free tier's per-minute limits.

### Making handlers safe to retry (idempotency)

A job may run **more than once** (crash after Gemini replied but before we saved). Handlers must be **idempotent** — running twice has the same effect as once:

```ts
// summarise.job.ts (shape)
export async function handleSummarise({ aiJobId }: { aiJobId: string }) {
  const job = await prisma.aiJob.findUniqueOrThrow({ where: { id: aiJobId } });
  if (job.status === 'DONE') return; // already finished on an earlier run

  await prisma.aiJob.update({ where: { id: aiJobId }, data: { status: 'RUNNING' } });
  const { documentId, style } = summaryInput.parse(job.input);

  const summary = await summariseDocument(documentId, style); // page 11 (checks the cache first)

  await prisma.aiJob.update({
    where: { id: aiJobId },
    data: { status: 'DONE', result: { summaryId: summary.id } },
  });
}
```

### The route that queues work

```ts
documentsRouter.post('/:id/summaries', aiLimiter, validateBody(summaryRequestSchema), async (req, res) => {
  const userId = currentUserId(req);
  const { id } = idParams.parse(req.params);

  const cached = await summaries.findCached(userId, id, req.body.style);
  if (cached) return void res.json({ status: 'DONE', summary: cached }); // no job needed

  await quota.consume(userId); // 429 if today's AI quota is used up
  const aiJob = await prisma.aiJob.create({
    data: { userId, type: 'SUMMARY', status: 'QUEUED', input: { documentId: id, style: req.body.style } },
  });
  await jobs.send('summarise', { aiJobId: aiJob.id });

  res.status(202).json({ status: 'QUEUED', jobId: aiJob.id }); // 202 Accepted = "working on it"
});
```

### Polling from React

```ts
const { data } = useQuery({
  queryKey: ['job', jobId],
  queryFn: () => api.get<JobStatus>(`/api/jobs/${jobId}`),
  enabled: Boolean(jobId),
  // keep asking every 2 s until the job is finished
  refetchInterval: (query) => (['DONE', 'FAILED'].includes(query.state.data?.status ?? '') ? false : 2000),
});
```

(Polling is simplest. Server-Sent Events or WebSockets would push updates instead — a good "how would you improve it?" answer.)

## Common mistakes

- Doing slow work in the request handler.
- Non-idempotent handlers (e.g. creating flashcards twice on a retry). Check state first or use unique constraints.
- Retrying errors that will never succeed (invalid input). Validate before queuing; let only temporary errors (429, 503, timeouts) retry.
- Putting large data in the job payload. Send ids; load data in the handler.

## Interview questions

**Q: Why use a job queue?**
A: To keep requests fast and reliable. Slow or flaky work — PDF parsing, AI calls — runs in a worker with retries and backoff, and the user gets an immediate 202 response and polls for the result.

**Q: What is idempotency and why does it matter for jobs?**
A: An operation is idempotent if running it twice gives the same result as once. Queues guarantee _at least once_ delivery, so a job can run twice; my handlers check whether the work is already done before doing it.

**Q: What's a dead-letter queue?**
A: Where jobs go after exhausting their retries, so they aren't lost or retried forever. I use it to mark the user's AI job as failed and show a friendly message.

## Try it yourself

1. Stop the API halfway through a summary job (Ctrl+C), start it again, and watch the job finish.
2. Temporarily set `GEMINI_API_KEY` to a wrong value and watch the retries in the logs, then the job land in `ai-failed`.
3. Open pgAdmin and look at the `pgboss.job` table (Prisma Studio only shows our own tables).
