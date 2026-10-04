// The background job queue. See docs/10-background-jobs.md.
//
// In the running app, jobs go into PostgreSQL through pg-boss, and a worker in the same
// process picks them up (with retries, so a crash mid-job isn't lost).
// In tests, `useInlineJobs()` runs each job straight away instead, so tests stay simple.
import { PgBoss } from 'pg-boss';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { handleExtractText, markFailed, type ExtractTextData } from './extractText.job.js';

/** Every job the app knows about, and the data each one carries (ids only, never big payloads). */
type JobData = {
  'extract-text': ExtractTextData;
};
export type JobName = keyof JobData;

const handlers: { [K in JobName]: (data: JobData[K]) => Promise<void> } = {
  'extract-text': handleExtractText,
};

let boss: PgBoss | undefined;
let inline = false;

export const jobs = {
  async send<K extends JobName>(name: K, data: JobData[K]): Promise<void> {
    if (inline) {
      try {
        await handlers[name](data);
      } catch (err) {
        logger.error({ err, name }, 'Inline job failed');
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

  await boss.createQueue('extract-text-failed'); // dead-letter queue: jobs that used up their retries
  await boss.createQueue('extract-text', {
    retryLimit: 2,
    retryDelay: 10,
    retryBackoff: true,
    deadLetter: 'extract-text-failed',
  });

  await boss.work<ExtractTextData>('extract-text', async (batch) => {
    for (const job of batch) await handlers['extract-text'](job.data);
  });
  await boss.work<ExtractTextData>('extract-text-failed', async (batch) => {
    for (const job of batch) await markFailed(job.data.documentId);
  });

  logger.info('Job worker started');
}

export async function stopJobWorker() {
  await boss?.stop({ graceful: true, timeout: 10_000 });
}
