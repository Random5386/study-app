// The background job queue. See docs/10-background-jobs.md.
//
// In the running app, jobs go into PostgreSQL through pg-boss, and a worker in the same
// process picks them up (with retries, so a crash mid-job isn't lost).
// In tests, `useInlineJobs()` runs each job straight away instead, so tests stay simple.
import { PgBoss } from 'pg-boss';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { handleExtractText, markFailed, type ExtractTextData } from './extractText.job.js';
import { handleSummarise, markSummariseFailed, type SummariseData } from './summarise.job.js';

/** Every job the app knows about, and the data each one carries (ids only, never big payloads). */
type JobData = {
  'extract-text': ExtractTextData;
  summarise: SummariseData;
};
export type JobName = keyof JobData;

type Handler<D> = {
  run: (data: D) => Promise<void>;
  /** Called once every retry has failed (from the dead-letter queue). */
  failed: (data: D) => Promise<void>;
};

const handlers: { [K in JobName]: Handler<JobData[K]> } = {
  'extract-text': { run: handleExtractText, failed: ({ documentId }) => markFailed(documentId) },
  summarise: { run: handleSummarise, failed: markSummariseFailed },
};

// How hard to try. AI calls get a longer delay: free-tier rate limits reset per minute.
const RETRY: Record<JobName, { retryLimit: number; retryDelay: number }> = {
  'extract-text': { retryLimit: 2, retryDelay: 10 },
  summarise: { retryLimit: 3, retryDelay: 20 },
};

let boss: PgBoss | undefined;
let inline = false;

export const jobs = {
  async send<K extends JobName>(name: K, data: JobData[K]): Promise<void> {
    if (inline) {
      // Tests: no retries, so a failure goes straight to the "every retry failed" handler.
      try {
        await handlers[name].run(data);
      } catch (err) {
        logger.debug({ err, name }, 'Inline job failed');
        await handlers[name].failed(data);
      }
      return;
    }
    if (!boss) throw new Error('The job worker is not running');
    await boss.send(name, data);
  },
};

/** Tests: run jobs immediately in the same request instead of queuing them. */
export function useInlineJobs() {
  inline = true;
}

export async function startJobWorker() {
  boss = new PgBoss(env.DATABASE_URL); // keeps its own tables in a "pgboss" schema; Prisma ignores them
  boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));
  await boss.start();

  for (const name of Object.keys(handlers) as JobName[]) {
    await registerQueue(boss, name);
  }
  logger.info('Job worker started');
}

async function registerQueue<K extends JobName>(boss: PgBoss, name: K) {
  const handler = handlers[name];
  await boss.createQueue(`${name}-failed`); // dead-letter queue: jobs that used up their retries
  await boss.createQueue(name, { ...RETRY[name], retryBackoff: true, deadLetter: `${name}-failed` });
  await boss.work<JobData[K]>(name, async (batch) => {
    for (const job of batch) await handler.run(job.data);
  });
  await boss.work<JobData[K]>(`${name}-failed`, async (batch) => {
    for (const job of batch) await handler.failed(job.data);
  });
}

export async function stopJobWorker() {
  await boss?.stop({ graceful: true, timeout: 10_000 });
}
