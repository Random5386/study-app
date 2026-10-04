import { z } from 'zod';

// Rules for the study guide library (subjects, documents, tags). See docs/09-file-uploads.md.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB per file
export const STORAGE_QUOTA_BYTES = 50 * 1024 * 1024; // 50 MB per user keeps the local database small
export const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md'] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const SUBJECT_COLOURS = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'slate'] as const;
export type SubjectColour = (typeof SUBJECT_COLOURS)[number];

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, 'Give the subject a name').max(60, 'Use at most 60 characters'),
  colour: z.enum(SUBJECT_COLOURS).default('indigo'),
});
export type SubjectCreateInput = z.input<typeof subjectCreateSchema>;

export const subjectUpdateSchema = subjectCreateSchema.partial();
export type SubjectUpdateInput = z.infer<typeof subjectUpdateSchema>;

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(30, 'Tags are at most 30 characters')
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Tags can use letters, numbers, spaces, - and _');

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(1, 'Give the document a title').max(200).optional(),
  subjectId: z.uuid().nullable().optional(), // null = move out of any subject
  tags: z.array(tagSchema).max(10, 'Use at most 10 tags').optional(),
});
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;

/** Filters for GET /api/documents. subjectId "none" = documents not in any subject. */
export const documentListQuerySchema = z.object({
  subjectId: z.union([z.uuid(), z.literal('none')]).optional(),
  q: z.string().trim().max(100).optional(),
  tag: tagSchema.optional(),
});
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

// ---- Shapes the API sends back ----

export type SubjectDto = {
  id: string;
  name: string;
  colour: SubjectColour;
  position: number;
  documentCount: number;
};

export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';

export type DocumentSummary = {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  failureReason: string | null;
  pageCount: number | null;
  wordCount: number | null;
  subjectId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type DocumentDetail = DocumentSummary & {
  /** The first part of the extracted text (the full text is at /api/documents/:id/text). */
  textPreview: string | null;
  textLength: number;
};

export type UploadResponse = { document: DocumentSummary; duplicate: boolean };

export type LibraryStats = { usedBytes: number; quotaBytes: number; documentCount: number };
