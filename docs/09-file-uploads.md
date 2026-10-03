# 9. File uploads and text extraction

## What it is

Users upload study guides (PDF, DOCX, TXT, MD). StudyApp must:

1. accept the file safely,
2. store it,
3. pull out its text (for search and for the AI), and
4. let the owner preview or download it later.

Uploads are one of the riskiest features in any web app — a file is attacker-controlled data — so this page is as much about security as features.

## Why we use these tools

| Tool        | Job                                                                   |
| ----------- | --------------------------------------------------------------------- |
| `multer`    | Parses `multipart/form-data` (the format browsers use to send files)  |
| `file-type` | Reads a file's first bytes (**magic bytes**) to see what it really is |
| `unpdf`     | Extracts text from PDFs (a modern wrapper around Mozilla's PDF.js)    |
| `mammoth`   | Extracts text from Word `.docx` files                                 |

**Where the bytes go:** in PostgreSQL (`DocumentFile.bytes`, a `bytea` column), behind a small `FileStorage` interface. That keeps local setup to one database, makes backups one command, and means the app can later run on hosts without a persistent disk. If the app grew, you'd swap the implementation to object storage (S3, Azure Blob) without touching features.

## Where it lives

```
apps/api/src/modules/documents/documents.routes.ts
apps/api/src/modules/documents/documents.service.ts
apps/api/src/lib/fileChecks.ts
apps/api/src/jobs/extractText.job.ts
apps/web/src/features/documents/UploadDropzone.tsx
```

## The code, explained

### Receiving the file — `documents.routes.ts`

```ts
import multer from 'multer';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(), // keep the file in memory; nothing touches the disk
  limits: { fileSize: MAX_BYTES, files: 1 }, // multer stops reading past 5 MB
});

documentsRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a file to upload');
  const doc = await documentsService.upload(currentUserId(req), req.file, req.body.subjectId);
  res.status(201).json(doc);
});
```

`upload.single('file')` reads the form field named `file` into `req.file` (`originalname`, `size`, `buffer`). When a file is too big, multer throws a `MulterError` with code `LIMIT_FILE_SIZE`; our error handler maps that to **413 Payload Too Large**.

### Checking what the file really is — `lib/fileChecks.ts`

A file called `notes.pdf` might really be an executable. The extension is just part of the name — the user controls it. So we check **both** the extension and the content:

```ts
import path from 'node:path';
import { isUtf8 } from 'node:buffer';
import { fileTypeFromBuffer } from 'file-type';
import { HttpError } from './httpError.js';

const ALLOWED = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
} as const;
type AllowedExt = keyof typeof ALLOWED;

const isAllowedExt = (ext: string): ext is AllowedExt => ext in ALLOWED;

export async function checkUpload(originalName: string, buffer: Buffer) {
  const ext = path.extname(originalName).slice(1).toLowerCase();
  if (!isAllowedExt(ext)) throw new HttpError(415, 'Only PDF, DOCX, TXT and MD files are allowed');

  const detected = await fileTypeFromBuffer(buffer); // undefined for plain text

  if (ext === 'pdf' || ext === 'docx') {
    if (detected?.ext !== ext) throw new HttpError(415, "The file's contents don't match its extension");
  } else {
    // Text files have no magic bytes: make sure it's not a binary in disguise, and is valid UTF-8.
    if (detected || !isUtf8(buffer)) throw new HttpError(415, 'That text file looks corrupted or binary');
  }
  return { ext, mimeType: ALLOWED[ext] };
}
```

`ext is AllowedExt` is a **type guard**: after the `if`, TypeScript knows `ext` is one of the four keys.

### Storing it — `documents.service.ts`

```ts
import { createHash } from 'node:crypto';
import path from 'node:path';

const USER_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB per user keeps the local database small

async upload(userId: string, file: Express.Multer.File, subjectId?: string) {
  const { mimeType } = await checkUpload(file.originalname, file.buffer);

  // Same file uploaded twice? Return the existing one instead of storing it again.
  const sha256 = createHash('sha256').update(file.buffer).digest('hex');
  const existing = await prisma.document.findFirst({ where: { userId, sha256 } });
  if (existing) return existing;

  const used = await prisma.document.aggregate({ where: { userId }, _sum: { sizeBytes: true } });
  if ((used._sum.sizeBytes ?? 0) + file.size > USER_LIMIT_BYTES) {
    throw new HttpError(413, 'You have reached the 50 MB storage limit');
  }

  const doc = await prisma.document.create({
    data: {
      userId,
      subjectId,
      title: path.parse(file.originalname).name.slice(0, 200),
      originalName: file.originalname,
      mimeType,
      sizeBytes: file.size,
      sha256,
      status: 'PROCESSING',
      file: { create: { bytes: file.buffer } },   // nested create → DocumentFile row, same transaction
    },
  });

  await jobs.send('extract-text', { documentId: doc.id }); // slow work happens in the background (page 10)
  return doc;                                              // metadata only — never send the bytes back here
}
```

> Before trusting `subjectId` from the form, the real code checks that subject belongs to `userId` too. Every id that comes from the browser gets an ownership check.

### Downloading / previewing

```ts
documentsRouter.get('/:id/file', async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { doc, bytes } = await documentsService.getFile(currentUserId(req), id); // 404 if not yours

  const inlinePdf = req.query.preview === '1' && doc.mimeType === 'application/pdf';
  res.type(doc.mimeType);
  res.set('X-Content-Type-Options', 'nosniff');
  if (inlinePdf) res.set('Content-Disposition', 'inline');
  else res.attachment(doc.originalName); // "Content-Disposition: attachment" → browser downloads, doesn't render
  res.send(Buffer.from(bytes));
});
```

Only PDFs are ever shown inline (in an `<iframe>` preview). Everything else downloads, so a malicious file can't execute in our origin.

### Extracting text — `jobs/extractText.job.ts`

```ts
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';

export async function handleExtractText({ documentId }: { documentId: string }) {
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId }, include: { file: true } });
  if (!doc.file) throw new Error(`Document ${documentId} has no file`);
  const bytes = doc.file.bytes;

  let text = '';
  let pageCount: number | null = null;

  if (doc.mimeType === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const result = await extractPdfText(pdf, { mergePages: true });
    text = result.text;
    pageCount = result.totalPages;
  } else if (doc.mimeType.includes('wordprocessingml')) {
    text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } else {
    text = Buffer.from(bytes).toString('utf8');
  }

  text = text.replace(/\u0000/g, '').trim(); // Postgres text columns can't store NUL characters

  await prisma.document.update({
    where: { id: documentId },
    data: {
      extractedText: text,
      pageCount,
      status: text ? 'READY' : 'FAILED', // empty text usually means a scanned (image-only) PDF
    },
  });
}
```

Scanned PDFs are pictures of text, so there's nothing to extract. The UI explains that and suggests a text-based PDF (OCR is a stretch goal).

## Common mistakes

- Trusting the file extension or the browser-sent MIME type (both are user-controlled).
- Saving uploads into a public folder the web server serves directly — someone uploads `evil.html` and it runs on your domain.
- No size limit → one upload can fill memory or disk.
- Building file paths from user input (`../../etc/passwd` — **path traversal**). We never write user-named files to disk.
- Doing slow parsing inside the request, so the user waits (and the request may time out).

## Interview questions

**Q: How do you handle file uploads securely?**
A: Size limit at the parser, extension allow-list plus magic-byte check, UTF-8 check for text, random ids instead of user filenames, bytes stored in the database rather than a public folder, ownership check on download, and downloads sent as attachments with `nosniff`. Text extraction runs in a background job.

**Q: What are magic bytes?**
A: The first few bytes of a file that identify its format — PDFs start with `%PDF`, DOCX files are ZIP archives starting with `PK`. Checking them catches files whose extension lies.

**Q: Why store files in the database? Isn't that unusual?**
A: For a small app with a 5 MB limit it keeps setup and backups simple and works on hosts without a disk. It's behind an interface, so moving to object storage like S3 later is one new class. At larger scale I'd use object storage, because databases are expensive places to keep big blobs.

## Try it yourself

1. Rename a `.png` to `.pdf` and upload it. You should get 415.
2. Upload the same PDF twice and confirm only one row exists in `Document`.
3. Upload a scanned PDF and check its status becomes `FAILED` with a helpful message.
