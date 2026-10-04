// Background job: extract the text of an uploaded document. See docs/10-background-jobs.md.
// Safe to run twice (idempotent): it only works on documents still marked PROCESSING.
import { prisma } from '../db/prisma.js';
import { logger } from '../lib/logger.js';
import { countWords, extractText, ExtractionError } from '../modules/documents/textExtraction.js';

export type ExtractTextData = { documentId: string };

export async function handleExtractText({ documentId }: ExtractTextData) {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { file: true } });
  if (!doc || doc.status !== 'PROCESSING') return; // deleted, or already done on an earlier run
  if (!doc.file) {
    await markFailed(documentId, 'The uploaded file is missing. Delete it and upload it again.');
    return;
  }

  try {
    const { text, pageCount } = await extractText(doc.file.bytes, doc.mimeType);
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'READY',
        extractedText: text,
        pageCount,
        wordCount: countWords(text),
        failureReason: null,
      },
    });
  } catch (err) {
    if (err instanceof ExtractionError) {
      await markFailed(documentId, err.message); // a problem with the file: retrying won't help
      return;
    }
    logger.error({ err, documentId }, 'Text extraction crashed');
    throw err; // unexpected: let the queue retry
  }
}

/** Called when every retry failed, so the user isn't left looking at "Processing…" forever. */
export async function markFailed(
  documentId: string,
  reason = 'Something went wrong reading this file. Try again.',
) {
  await prisma.document.updateMany({
    where: { id: documentId, status: 'PROCESSING' },
    data: { status: 'FAILED', failureReason: reason },
  });
}
