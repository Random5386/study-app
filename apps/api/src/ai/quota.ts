// A per-user limit on AI requests, so one user (or a bug in a loop) can't use up the whole
// free tier. The window "rolls": each request counts for 24 hours after it was made.
// Failed requests don't count against you; cached answers never create a request at all.
import type { AiUsage } from '@studyapp/shared';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { HttpError } from '../lib/httpError.js';
import { getAiClient } from './index.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function aiUsage(userId: string, now = new Date()): Promise<AiUsage> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const [user, recent] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { aiDailyQuota: true } }),
    prisma.aiJob.findMany({
      where: { userId, createdAt: { gt: since }, status: { not: 'FAILED' } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const oldest = recent[0];
  return {
    enabled: getAiClient() !== null,
    used: recent.length,
    // AI_DAILY_QUOTA in .env is the ceiling for everyone; User.aiDailyQuota can lower it for one person.
    limit: Math.min(user.aiDailyQuota, env.AI_DAILY_QUOTA),
    resetsAt: oldest ? new Date(oldest.createdAt.getTime() + WINDOW_MS).toISOString() : null,
  };
}

/** "about 3 hours", "about 20 minutes": how long until the next request frees up. */
export function untilText(resetsAt: string | null, now = Date.now()): string {
  if (!resetsAt) return 'soon';
  const minutes = Math.max(1, Math.ceil((new Date(resetsAt).getTime() - now) / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? '' : 's'}`;
}

export async function assertQuotaLeft(userId: string) {
  const usage = await aiUsage(userId);
  if (usage.used >= usage.limit) {
    throw new HttpError(
      429,
      `You've used all ${usage.limit} AI requests for the last 24 hours. The next one frees up ${untilText(usage.resetsAt)}.`,
      { reason: 'AI_QUOTA', usage },
    );
  }
}
