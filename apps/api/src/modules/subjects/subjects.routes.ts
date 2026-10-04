// Subjects (folders for study material): /api/subjects/...
import { Router } from 'express';
import { z } from 'zod';
import {
  subjectCreateSchema,
  subjectUpdateSchema,
  type SubjectColour,
  type SubjectDto,
} from '@studyapp/shared';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/httpError.js';
import { currentUserId } from '../../middleware/requireAuth.js';
import { validateBody } from '../../middleware/validate.js';

const idParams = z.object({ id: z.uuid() });

const subjectSelect = {
  id: true,
  name: true,
  colour: true,
  position: true,
  _count: { select: { documents: true } },
} satisfies Prisma.SubjectSelect;

function toDto(row: Prisma.SubjectGetPayload<{ select: typeof subjectSelect }>): SubjectDto {
  return {
    id: row.id,
    name: row.name,
    colour: row.colour as SubjectColour,
    position: row.position,
    documentCount: row._count.documents,
  };
}

/** Turn "unique name" database errors into a friendly 409. */
function rethrowDuplicate(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new HttpError(409, 'You already have a subject with that name');
  }
  throw err;
}

export const subjectsRouter = Router();

subjectsRouter.get('/', async (req, res) => {
  const rows = await prisma.subject.findMany({
    where: { userId: currentUserId(req) },
    select: subjectSelect,
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });
  res.json(rows.map(toDto));
});

subjectsRouter.post('/', validateBody(subjectCreateSchema), async (req, res) => {
  const userId = currentUserId(req);
  const last = await prisma.subject.aggregate({ where: { userId }, _max: { position: true } });
  const row = await prisma.subject
    .create({
      data: { ...req.body, userId, position: (last._max.position ?? -1) + 1 },
      select: subjectSelect,
    })
    .catch(rethrowDuplicate);
  res.status(201).json(toDto(row));
});

subjectsRouter.patch('/:id', validateBody(subjectUpdateSchema), async (req, res) => {
  const userId = currentUserId(req);
  const { id } = idParams.parse(req.params);
  const { count } = await prisma.subject
    .updateMany({ where: { id, userId }, data: req.body })
    .catch(rethrowDuplicate);
  if (count === 0) throw new HttpError(404, 'Subject not found');
  res.json(toDto(await prisma.subject.findUniqueOrThrow({ where: { id }, select: subjectSelect })));
});

// Deleting a subject keeps its documents: they just become "not in a subject" (onDelete: SetNull).
subjectsRouter.delete('/:id', async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { count } = await prisma.subject.deleteMany({ where: { id, userId: currentUserId(req) } });
  if (count === 0) throw new HttpError(404, 'Subject not found');
  res.status(204).end();
});
