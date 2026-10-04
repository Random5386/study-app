// HTTP endpoints for the study guide library: /api/documents/...
// Everything here is behind requireAuth (see app.ts).
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { documentListQuerySchema, documentUpdateSchema, MAX_UPLOAD_BYTES } from '@studyapp/shared';
import { HttpError } from '../../lib/httpError.js';
import { currentUserId } from '../../middleware/requireAuth.js';
import { validateBody } from '../../middleware/validate.js';
import { documentsService } from './documents.service.js';

const idParams = z.object({ id: z.uuid() });
const uploadFields = z.object({
  subjectId: z
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

const upload = multer({
  storage: multer.memoryStorage(), // keep the file in memory; nothing is written to disk
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 }, // multer stops reading past 5 MB
});

export const documentsRouter = Router();

documentsRouter.get('/', async (req, res) => {
  const query = documentListQuerySchema.parse(req.query);
  res.json(await documentsService.list(currentUserId(req), query));
});

documentsRouter.get('/stats', async (req, res) => {
  res.json(await documentsService.stats(currentUserId(req)));
});

documentsRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Choose a file to upload');
  const { subjectId } = uploadFields.parse(req.body ?? {});
  const result = await documentsService.upload(currentUserId(req), req.file, subjectId);
  res.status(result.duplicate ? 200 : 201).json(result);
});

documentsRouter.get('/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await documentsService.get(currentUserId(req), id));
});

documentsRouter.get('/:id/text', async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ text: await documentsService.fullText(currentUserId(req), id) });
});

// Downloads the original file. It's always sent as an attachment (never shown inline),
// so a malicious upload can't run in our site's origin.
documentsRouter.get('/:id/file', async (req, res) => {
  const { id } = idParams.parse(req.params);
  const file = await documentsService.getFile(currentUserId(req), id);
  res.attachment(file.originalName); // Content-Disposition: attachment; filename="..."
  res.type(file.mimeType);
  res.set('Cache-Control', 'private, no-store');
  res.send(Buffer.from(file.bytes));
});

documentsRouter.patch('/:id', validateBody(documentUpdateSchema), async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await documentsService.update(currentUserId(req), id, req.body));
});

documentsRouter.post('/:id/retry', async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json(await documentsService.retry(currentUserId(req), id));
});

documentsRouter.delete('/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  await documentsService.remove(currentUserId(req), id);
  res.status(204).end();
});
