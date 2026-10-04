// Background job: summarise a document with AI. See docs/10-background-jobs.md and docs/11-ai-gemini.md.
// Safe to run twice: a finished job is skipped, and the summary is saved with an upsert.
import type { Prisma } from '../generated/prisma/client.js';
import { PermanentAiError, TemporaryAiError } from '../ai/aiClient.js';
import { getAiClient } from '../ai/index.js';
import { SUMMARY_PROMPT_VERSION, summariseText } from '../ai/summarise.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import type { SummaryStyle } from '@studyapp/shared';

export type SummariseData = { aiJobId: string };

const fail = (id: string, error: string) =>
  prisma.aiJob.updateMany({
    where: { id, status: { in: ['QUEUED', 'RUNNING'] } },
    data: { status: 'FAILED', error, finishedAt: new Date() },
  });

export async function handleSummarise({ aiJobId }: SummariseData) {
  const job = await prisma.aiJob.findUnique({ where: { id: aiJobId } });
  if (!job || job.status === 'DONE' || job.status === 'FAILED') return;
  const { style } = job.input as { style: SummaryStyle };

  const doc = job.documentId
    ? await prisma.document.findUnique({
        where: { id: job.documentId },
        select: { id: true, extractedText: true },
      })
    : null;
  if (!doc?.extractedText) {
    await fail(aiJobId, 'The document was deleted or has no text.');
    return;
  }
  const ai = getAiClient();
  if (!ai) {
    await fail(aiJobId, "AI isn't set up on this server. Add GEMINI_API_KEY to .env.");
    return;
  }

  await prisma.aiJob.update({ where: { id: aiJobId }, data: { status: 'RUNNING' } });
  try {
    const result = await summariseText(ai, doc.extractedText, style);
    const where = {
      documentId_style_promptVersion: { documentId: doc.id, style, promptVersion: SUMMARY_PROMPT_VERSION },
    };
    const content = {
      points: result.points,
      keyTerms: result.keyTerms as unknown as Prisma.InputJsonValue,
      model: result.model,
    };
    const summary = await prisma.summary.upsert({
      where,
      create: { documentId: doc.id, style, promptVersion: SUMMARY_PROMPT_VERSION, ...content },
      update: {}, // already there (job ran twice): keep the first one
    });
    await prisma.aiJob.update({
      where: { id: aiJobId },
      data: {
        status: 'DONE',
        summaryId: summary.id,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        error: null,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof PermanentAiError) {
      await fail(aiJobId, err.message); // retrying won't help (e.g. a bad API key)
      return;
    }
    // Remember why (if the reason is safe to show), then let the queue retry with backoff.
    if (!(err instanceof TemporaryAiError)) logger.error({ err, aiJobId }, 'Summary job crashed');
    const error = err instanceof TemporaryAiError ? err.message : null;
    await prisma.aiJob.update({ where: { id: aiJobId }, data: { status: 'QUEUED', error } });
    throw err;
  }
}

/** Every retry failed: tell the user instead of spinning forever. Keeps the last error message. */
export async function markSummariseFailed({ aiJobId }: SummariseData) {
  const job = await prisma.aiJob.findUnique({ where: { id: aiJobId }, select: { error: true } });
  await fail(aiJobId, job?.error ?? 'The AI request failed after several tries. Try again later.');
}
