import { z } from 'zod';

// AI features (phase 4): summaries now, flashcard drafts in phase 5.
// See docs/11-ai-gemini.md.

export const SUMMARY_STYLES = ['BRIEF', 'DETAILED', 'BULLETS'] as const;
export type SummaryStyle = (typeof SUMMARY_STYLES)[number];

export const SUMMARY_STYLE_LABELS: Record<SummaryStyle, { label: string; hint: string }> = {
  BRIEF: { label: 'Brief', hint: 'One short paragraph' },
  DETAILED: { label: 'Detailed', hint: 'Every main idea, in a few paragraphs' },
  BULLETS: { label: 'Bullet points', hint: 'Quick revision list' },
};

export const createSummarySchema = z.object({ style: z.enum(SUMMARY_STYLES) });
export type CreateSummaryInput = z.infer<typeof createSummarySchema>;

export type KeyTerm = { term: string; definition: string };

/**
 * What the model must send back. The same schema is sent to Gemini as a JSON schema
 * (so it knows the shape) and used to validate the reply (so we never trust it blindly).
 */
export const summaryOutputSchema = z.object({
  points: z.array(z.string().trim().min(1).max(2000)).min(1).max(20),
  keyTerms: z
    .array(
      z.object({
        term: z.string().trim().min(1).max(100),
        definition: z.string().trim().min(1).max(400),
      }),
    )
    .max(12),
});
export type SummaryOutput = z.infer<typeof summaryOutputSchema>;

export type SummaryDto = {
  id: string;
  style: SummaryStyle;
  audience: string; // who it was written for, e.g. "HIGH_SCHOOL:10" (see describeAudience)
  points: string[];
  keyTerms: KeyTerm[];
  model: string;
  createdAt: string;
};

export type AiJobStatus = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

export type AiJobDto = {
  id: string;
  status: AiJobStatus;
  style: SummaryStyle;
  error: string | null;
  summaryId: string | null;
  createdAt: string;
};

/** How many AI requests you have left. The window rolls: each request "comes back" 24 hours later. */
export type AiUsage = {
  enabled: boolean; // false when the server has no Gemini key
  used: number;
  limit: number;
  resetsAt: string | null; // when the oldest request in the window expires (null if none used)
};

/** GET /api/documents/:id/summaries */
export type DocumentSummariesResponse = {
  summaries: SummaryDto[];
  jobs: AiJobDto[]; // unfinished or recently failed jobs, newest first
  usage: AiUsage;
};

/** POST /api/documents/:id/summaries: either a cached summary (200) or a new job (202). */
export type CreateSummaryResponse = { summary: SummaryDto; cached: true } | { job: AiJobDto; cached: false };
