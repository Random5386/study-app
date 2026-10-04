// Business rules for the study guide library. Every query includes the user's id,
// so one user can never see or change another user's documents. See docs/09-file-uploads.md.
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  STORAGE_QUOTA_BYTES,
  type DocumentDetail,
  type DocumentListQuery,
  type DocumentSummary,
  type DocumentUpdateInput,
  type LibraryStats,
  type UploadResponse,
} from '@studyapp/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { jobs } from '../../jobs/queue.js';
import { checkUpload } from '../../lib/fileChecks.js';
import { HttpError } from '../../lib/httpError.js';

const PREVIEW_CHARS = 20_000;

// The columns a list needs: never the big extractedText or the file bytes.
const summarySelect = {
  id: true,
  title: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  failureReason: true,
  pageCount: true,
  wordCount: true,
  subjectId: true,
  createdAt: true,
  updatedAt: true,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.DocumentSelect;

type SummaryRow = Prisma.DocumentGetPayload<{ select: typeof summarySelect }>;

function toSummary(row: SummaryRow): DocumentSummary {
  const { tags, createdAt, updatedAt, ...rest } = row;
  return {
    ...rest,
    tags: tags.map((t) => t.tag.name).sort(),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/** Throws 404 unless the subject exists AND belongs to this user. */
async function assertOwnSubject(userId: string, subjectId: string) {
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId }, select: { id: true } });
  if (!subject) throw new HttpError(404, 'Subject not found');
}

export type UploadedFile = { originalname: string; size: number; buffer: Buffer };

export const documentsService = {
  async list(userId: string, query: DocumentListQuery): Promise<DocumentSummary[]> {
    const where: Prisma.DocumentWhereInput = { userId };
    if (query.subjectId) where.subjectId = query.subjectId === 'none' ? null : query.subjectId;
    if (query.tag) where.tags = { some: { tag: { name: query.tag } } };
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { extractedText: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.document.findMany({
      where,
      select: summarySelect,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSummary);
  },

  async get(userId: string, id: string): Promise<DocumentDetail> {
    const row = await prisma.document.findFirst({
      where: { id, userId },
      select: { ...summarySelect, extractedText: true },
    });
    if (!row) throw new HttpError(404, 'Document not found');
    const { extractedText, ...summary } = row;
    return {
      ...toSummary(summary),
      textPreview: extractedText?.slice(0, PREVIEW_CHARS) ?? null,
      textLength: extractedText?.length ?? 0,
    };
  },

  async fullText(userId: string, id: string): Promise<string> {
    const row = await prisma.document.findFirst({ where: { id, userId }, select: { extractedText: true } });
    if (!row) throw new HttpError(404, 'Document not found');
    return row.extractedText ?? '';
  },

  async upload(userId: string, file: UploadedFile, subjectId?: string): Promise<UploadResponse> {
    const { mimeType } = await checkUpload(file.originalname, file.buffer);
    if (subjectId) await assertOwnSubject(userId, subjectId);

    // Same file already uploaded? Return it instead of storing it twice.
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await prisma.document.findUnique({
      where: { userId_sha256: { userId, sha256 } },
      select: summarySelect,
    });
    if (existing) return { document: toSummary(existing), duplicate: true };

    const { usedBytes } = await this.stats(userId);
    if (usedBytes + file.size > STORAGE_QUOTA_BYTES) {
      throw new HttpError(413, 'You have used your 50 MB of storage. Delete some documents to upload more.');
    }

    let row: SummaryRow;
    try {
      row = await prisma.document.create({
        data: {
          userId,
          subjectId: subjectId ?? null,
          title: path.parse(file.originalname).name.trim().slice(0, 200) || 'Untitled',
          originalName: file.originalname.slice(0, 255),
          mimeType,
          sizeBytes: file.size,
          sha256,
          file: { create: { bytes: new Uint8Array(file.buffer) } }, // same transaction as the Document row
        },
        select: summarySelect,
      });
    } catch (err) {
      // Two identical uploads at the same moment: the unique index lets only one through.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await prisma.document.findUniqueOrThrow({
          where: { userId_sha256: { userId, sha256 } },
          select: summarySelect,
        });
        return { document: toSummary(again), duplicate: true };
      }
      throw err;
    }

    await jobs.send('extract-text', { documentId: row.id }); // slow work happens in the background
    const fresh = await prisma.document.findUniqueOrThrow({ where: { id: row.id }, select: summarySelect });
    return { document: toSummary(fresh), duplicate: false };
  },

  async update(userId: string, id: string, input: DocumentUpdateInput): Promise<DocumentDetail> {
    const doc = await prisma.document.findFirst({ where: { id, userId }, select: { id: true } });
    if (!doc) throw new HttpError(404, 'Document not found');
    if (input.subjectId) await assertOwnSubject(userId, input.subjectId);

    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.subjectId !== undefined && { subjectId: input.subjectId }),
        },
      });
      if (input.tags) {
        // Replace the document's tags: create any new tag names, then relink.
        const names = [...new Set(input.tags)];
        const tags = await Promise.all(
          names.map((name) =>
            tx.tag.upsert({ where: { userId_name: { userId, name } }, create: { userId, name }, update: {} }),
          ),
        );
        await tx.documentTag.deleteMany({ where: { documentId: id } });
        await tx.documentTag.createMany({ data: tags.map((t) => ({ documentId: id, tagId: t.id })) });
      }
    });
    return this.get(userId, id);
  },

  async remove(userId: string, id: string) {
    const { count } = await prisma.document.deleteMany({ where: { id, userId } }); // the file goes too (cascade)
    if (count === 0) throw new HttpError(404, 'Document not found');
  },

  async getFile(userId: string, id: string) {
    const doc = await prisma.document.findFirst({
      where: { id, userId },
      select: { originalName: true, mimeType: true, file: { select: { bytes: true } } },
    });
    if (!doc?.file) throw new HttpError(404, 'Document not found');
    return { originalName: doc.originalName, mimeType: doc.mimeType, bytes: doc.file.bytes };
  },

  /** Try extracting the text again (only for documents that failed). */
  async retry(userId: string, id: string): Promise<DocumentDetail> {
    const doc = await prisma.document.findFirst({ where: { id, userId }, select: { id: true } });
    if (!doc) throw new HttpError(404, 'Document not found');
    const { count } = await prisma.document.updateMany({
      where: { id, userId, status: 'FAILED' },
      data: { status: 'PROCESSING', failureReason: null },
    });
    if (count === 0) throw new HttpError(409, 'Only documents that failed can be retried');
    await jobs.send('extract-text', { documentId: id });
    return this.get(userId, id);
  },

  async stats(userId: string): Promise<LibraryStats> {
    const agg = await prisma.document.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
      _count: true,
    });
    return { usedBytes: agg._sum.sizeBytes ?? 0, quotaBytes: STORAGE_QUOTA_BYTES, documentCount: agg._count };
  },
};
