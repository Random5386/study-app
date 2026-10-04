// Is this upload really the kind of file it claims to be? See docs/09-file-uploads.md.
// The extension is part of the file NAME, which the user controls, so we also check the
// file's first bytes ("magic bytes") and, for text files, that the content is valid UTF-8 text.
import path from 'node:path';
import { isUtf8 } from 'node:buffer';
import { fileTypeFromBuffer } from 'file-type';
import { ALLOWED_EXTENSIONS, type AllowedExtension } from '@studyapp/shared';
import { HttpError } from './httpError.js';

export const MIME_TYPES: Record<AllowedExtension, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
};

/** Type guard: after `if (isAllowedExt(ext))`, TypeScript knows ext is one of the four. */
const isAllowedExt = (ext: string): ext is AllowedExtension =>
  (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);

export async function checkUpload(originalName: string, buffer: Buffer) {
  const ext = path.extname(originalName).slice(1).toLowerCase();
  if (!isAllowedExt(ext)) throw new HttpError(415, 'Only PDF, DOCX, TXT and MD files are allowed');
  if (buffer.length === 0) throw new HttpError(400, 'That file is empty');

  const detected = await fileTypeFromBuffer(buffer); // undefined for plain text

  if (ext === 'pdf' || ext === 'docx') {
    if (detected?.ext !== ext) {
      throw new HttpError(
        415,
        `That file doesn't look like a real .${ext} file. Its contents don't match its name.`,
      );
    }
  } else if (detected || !isUtf8(buffer) || buffer.includes(0)) {
    // Text files have no magic bytes: refuse anything binary in disguise.
    throw new HttpError(415, 'That text file looks damaged or binary. Save it as UTF-8 text and try again.');
  }
  return { ext, mimeType: MIME_TYPES[ext] };
}
