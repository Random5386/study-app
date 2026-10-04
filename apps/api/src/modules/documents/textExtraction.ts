// Pull plain text out of an uploaded file, so we can search it and (in phase 4) summarise it.
import mammoth from 'mammoth';
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';

const MAX_TEXT_CHARS = 2_000_000; // plenty for a 5 MB study guide
const BYTE_ORDER_MARK = /^\uFEFF/;

export type Extracted = { text: string; pageCount: number | null };

/** A problem with the file itself; its message is safe to show the user. */
export class ExtractionError extends Error {}

export async function extractText(bytes: Uint8Array, mimeType: string): Promise<Extracted> {
  let text: string;
  let pageCount: number | null = null;

  if (mimeType === 'application/pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes)); // copy: pdf.js takes ownership of the buffer
      const result = await extractPdfText(pdf, { mergePages: true });
      text = result.text;
      pageCount = result.totalPages;
    } catch {
      throw new ExtractionError("We couldn't open this PDF. It may be password-protected or damaged.");
    }
  } else if (mimeType.includes('wordprocessingml')) {
    try {
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } catch {
      throw new ExtractionError("We couldn't open this Word document. It may be damaged.");
    }
  } else {
    text = Buffer.from(bytes).toString('utf8').replace(BYTE_ORDER_MARK, ''); // drop a byte-order mark
  }

  text = tidy(text);
  if (!text) {
    throw new ExtractionError(
      mimeType === 'application/pdf'
        ? 'No text found. This looks like a scanned PDF (pictures of pages). Upload a text-based PDF instead.'
        : 'This file has no text in it.',
    );
  }
  return { text: text.slice(0, MAX_TEXT_CHARS), pageCount };
}

/** Normalise line endings, remove characters Postgres can't store, collapse big gaps. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replaceAll('\0', '') // NUL characters can't be stored in Postgres text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;
