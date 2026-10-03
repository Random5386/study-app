// Security history: one row per security event, shown on the Security page.
// See docs/08-web-security.md ("Safe logging").
import type { Request } from 'express';
import { prisma } from '../db/prisma.js';
import type { AuditEvent } from '../generated/prisma/client.js';
import { logger } from './logger.js';

/** IP address and browser of the request, trimmed to a safe length. */
export function requestInfo(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
  };
}

export async function audit(userId: string, event: AuditEvent, req?: Request) {
  try {
    await prisma.auditLog.create({ data: { userId, event, ...(req ? requestInfo(req) : {}) } });
  } catch (err) {
    // Never let a logging failure break a login.
    logger.error({ err, userId, event }, 'Could not write audit log');
  }
}
