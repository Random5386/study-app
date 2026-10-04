// AI summaries of study guides: cached results, background jobs, and the quota.
// The flow: POST asks for a summary → cached? return it : create an AiJob and queue it →
// the browser polls GET /api/ai/jobs/:id until it's DONE → GET the summaries again.
import {
  audienceKey,
  type AiJobDto,
  type CreateSummaryResponse,
  type DocumentSummariesResponse,
  type KeyTerm,
  type StudyLevel,
  type SummaryDto,
  type SummaryStyle,
} from '@studyapp/shared';
import { getAiClient } from '../../ai/index.js';
import { aiUsage, assertQuotaLeft } from '../../ai/quota.js';
import { SUMMARY_PROMPT_VERSION } from '../../ai/summarise.js';
import { prisma } from '../../db/prisma.js';
import type { AiJob, Summary } from '../../generated/prisma/client.js';
import { jobs } from '../../jobs/queue.js';
import { HttpError } from '../../lib/httpError.js';

export function toSummaryDto(s: Summary): SummaryDto {
  return {
    id: s.id,
    style: s.style,
    audience: s.audience,
    points: s.points as string[],
    keyTerms: s.keyTerms as KeyTerm[],
    model: s.model,
    createdAt: s.createdAt.toISOString(),
  };
}

export function toJobDto(j: AiJob): AiJobDto {
  return {
    id: j.id,
    status: j.status,
    style: (j.input as { style: SummaryStyle }).style,
    error: j.error,
    summaryId: j.summaryId,
    createdAt: j.createdAt.toISOString(),
  };
}

/** What an AI job remembers about the request (AiJob.input). */
export type SummaryJobInput = {
  style: SummaryStyle;
  audience: string; // cache key, e.g. "HIGH_SCHOOL:10"
  studyLevel: StudyLevel | null;
  schoolGrade: number | null;
};

/** Who this user's AI output is written for, from their study level. */
async function audienceOf(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { studyLevel: true, schoolGrade: true },
  });
  return { ...user, audience: audienceKey(user.studyLevel, user.schoolGrade) };
}

/** The document, if this user owns it. 404 (not 403) for other people's, so ids can't be probed. */
async function ownDocument(userId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true, status: true, extractedText: true },
  });
  if (!doc) throw new HttpError(404, 'Document not found');
  return doc;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const summariesService = {
  async listForDocument(userId: string, documentId: string): Promise<DocumentSummariesResponse> {
    await ownDocument(userId, documentId);
    const { audience } = await audienceOf(userId);
    const [summaries, recentJobs, usage] = await Promise.all([
      prisma.summary.findMany({
        where: { documentId, promptVersion: SUMMARY_PROMPT_VERSION, audience }, // written for your level
        orderBy: { createdAt: 'asc' },
      }),
      prisma.aiJob.findMany({
        where: { documentId, userId, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
        orderBy: { createdAt: 'desc' },
      }),
      aiUsage(userId),
    ]);
    // For each style, show the newest job only if it hasn't finished well (still running, or failed).
    const latestPerStyle = new Map<string, AiJob>();
    for (const job of recentJobs) {
      const input = job.input as Partial<SummaryJobInput>;
      if (input.audience !== audience || !input.style) continue; // made before you changed your level
      if (!latestPerStyle.has(input.style)) latestPerStyle.set(input.style, job);
    }
    const jobsToShow = [...latestPerStyle.values()].filter((j) => j.status !== 'DONE');
    return { summaries: summaries.map(toSummaryDto), jobs: jobsToShow.map(toJobDto), usage };
  },

  async request(userId: string, documentId: string, style: SummaryStyle): Promise<CreateSummaryResponse> {
    const doc = await ownDocument(userId, documentId);
    if (doc.status !== 'READY' || !doc.extractedText?.trim()) {
      throw new HttpError(400, "This guide has no text to summarise yet. Wait until it's Ready.");
    }

    // 1. Already summarised in this style, for this study level, with the current prompt? Free and instant.
    const who = await audienceOf(userId);
    const cached = await prisma.summary.findUnique({
      where: {
        documentId_style_promptVersion_audience: {
          documentId,
          style,
          promptVersion: SUMMARY_PROMPT_VERSION,
          audience: who.audience,
        },
      },
    });
    if (cached) return { summary: toSummaryDto(cached), cached: true };

    // 2. Already working on it (double click, second tab)? Return that job instead of paying twice.
    const inFlight = await prisma.aiJob.findMany({
      where: { documentId, userId, status: { in: ['QUEUED', 'RUNNING'] } },
    });
    const running = inFlight.find((j) => {
      const input = j.input as Partial<SummaryJobInput>;
      return input.style === style && input.audience === who.audience;
    });
    if (running) return { job: toJobDto(running), cached: false };

    // 3. A new request: needs a key and quota left.
    if (!getAiClient()) {
      throw new HttpError(503, "AI isn't set up on this server yet. Add GEMINI_API_KEY to .env and restart.");
    }
    await assertQuotaLeft(userId);

    const input: SummaryJobInput = {
      style,
      audience: who.audience,
      studyLevel: who.studyLevel,
      schoolGrade: who.schoolGrade,
    };
    const job = await prisma.aiJob.create({ data: { userId, documentId, type: 'SUMMARY', input } });
    await jobs.send('summarise', { aiJobId: job.id });
    const fresh = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } }); // tests run jobs inline
    return { job: toJobDto(fresh), cached: false };
  },

  async getJob(userId: string, jobId: string): Promise<AiJobDto> {
    const job = await prisma.aiJob.findFirst({ where: { id: jobId, userId } });
    if (!job) throw new HttpError(404, 'AI request not found');
    return toJobDto(job);
  },
};
