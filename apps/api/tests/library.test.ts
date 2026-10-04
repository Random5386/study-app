// The study guide library: uploads, text extraction, subjects, tags, search,
// and proof that users can't reach each other's documents.
import { describe, expect, it } from 'vitest';
import { STORAGE_QUOTA_BYTES } from '@studyapp/shared';
import { prisma } from '../src/db/prisma.js';
import { makeDocx, makePdf, makeScannedPdf, PNG_BYTES } from './fixtures.js';
import { signedInUser } from './helpers.js';

describe('uploading study guides', () => {
  it('extracts text from PDF, DOCX, TXT and Markdown files', async () => {
    const { browser } = await signedInUser();

    const pdf = await browser
      .upload('Cell biology.pdf', await makePdf(['Mitochondria', 'Ribosomes']))
      .expect(201);
    expect(pdf.body.duplicate).toBe(false);
    expect(pdf.body.document).toMatchObject({ title: 'Cell biology', status: 'READY', pageCount: 2 });

    const docx = await browser
      .upload('Notes.docx', await makeDocx(['Photosynthesis makes glucose']))
      .expect(201);
    expect(docx.body.document.status).toBe('READY');

    await browser
      .upload('plain.txt', '\uFEFFOsmosis moves water' /* starts with a byte-order mark */)
      .expect(201);
    await browser.upload('summary.md', '# Heading\n\nDiffusion').expect(201);

    const detail = await browser.agent.get(`/api/documents/${pdf.body.document.id}`).expect(200);
    expect(detail.body.textPreview).toContain('Mitochondria');
    expect(detail.body.textPreview).toContain('Ribosomes');
    const word = await browser.agent.get(`/api/documents/${docx.body.document.id}/text`).expect(200);
    expect(word.body.text).toBe('Photosynthesis makes glucose');
  });

  it('stores the same file only once', async () => {
    const { browser } = await signedInUser();
    const first = await browser.upload('a.txt', 'Same content').expect(201);
    const again = await browser.upload('b.txt', 'Same content').expect(200);
    expect(again.body).toMatchObject({ duplicate: true, document: { id: first.body.document.id } });
  });

  it("refuses files whose contents don't match their name", async () => {
    const { browser } = await signedInUser();
    await browser.upload('photo.pdf', PNG_BYTES).expect(415); // an image pretending to be a PDF
    await browser.upload('virus.exe', 'MZ...').expect(415); // not an allowed extension
    await browser.upload('binary.txt', PNG_BYTES).expect(415); // binary pretending to be text
    await browser.upload('empty.txt', '').expect(400);
  });

  it('refuses files over 5 MB', async () => {
    const { browser } = await signedInUser();
    const res = await browser.upload('huge.txt', 'a'.repeat(5 * 1024 * 1024 + 1)).expect(413);
    expect(res.body.error).toMatch(/bigger than 5 MB/);
  });

  it('refuses uploads past the 50 MB storage quota', async () => {
    const { email, browser } = await signedInUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.document.create({
      data: {
        userId: user.id,
        title: 'Big',
        originalName: 'big.pdf',
        mimeType: 'application/pdf',
        sizeBytes: STORAGE_QUOTA_BYTES - 5,
        sha256: 'fake-hash',
        status: 'READY',
      },
    });
    await browser.upload('one-more.txt', 'more than five bytes').expect(413);
  });

  it('marks a scanned PDF as failed with a helpful reason, and only failed documents can be retried', async () => {
    const { browser } = await signedInUser();
    const scanned = await browser.upload('scan.pdf', await makeScannedPdf()).expect(201);
    expect(scanned.body.document.status).toBe('FAILED');
    expect(scanned.body.document.failureReason).toMatch(/scanned PDF/);

    const retried = await browser.post(`/api/documents/${scanned.body.document.id}/retry`).expect(200);
    expect(retried.body.status).toBe('FAILED'); // still no text, but it ran again

    const ok = await browser.upload('fine.txt', 'Some text').expect(201);
    await browser.post(`/api/documents/${ok.body.document.id}/retry`).expect(409);
  });

  it('downloads the original file as an attachment', async () => {
    const { browser } = await signedInUser();
    const pdfBytes = await makePdf(['Download me']);
    const up = await browser.upload('Exam guide.pdf', pdfBytes).expect(201);

    const res = await browser.agent
      .get(`/api/documents/${up.body.document.id}/file`)
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="Exam guide.pdf"/);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(Buffer.compare(res.body as Buffer, pdfBytes)).toBe(0);
  });

  it('needs a CSRF token to upload', async () => {
    const { browser } = await signedInUser();
    await browser.agent.post('/api/documents').attach('file', Buffer.from('hi'), 'x.txt').expect(403);
  });
});

describe('organising: subjects, tags and search', () => {
  it('files documents into subjects, tags them, and filters the list', async () => {
    const { browser } = await signedInUser();
    const bio = await browser.post('/api/subjects', { name: 'Biology', colour: 'emerald' }).expect(201);
    await browser.post('/api/subjects', { name: 'Biology' }).expect(409); // names are unique per user

    const cells = await browser.upload('cells.txt', 'The cell membrane', bio.body.id).expect(201);
    const loose = await browser.upload('history.txt', 'The French Revolution').expect(201);

    await browser
      .patch(`/api/documents/${loose.body.document.id}`, {
        title: 'Revolutions',
        tags: ['Exam', 'term-2', 'exam'],
      })
      .expect(200);

    const inBio = await browser.agent.get(`/api/documents?subjectId=${bio.body.id}`).expect(200);
    expect(inBio.body.map((d: { id: string }) => d.id)).toEqual([cells.body.document.id]);

    const unfiled = await browser.agent.get('/api/documents?subjectId=none').expect(200);
    expect(unfiled.body).toHaveLength(1);
    expect(unfiled.body[0]).toMatchObject({ title: 'Revolutions', tags: ['exam', 'term-2'] });

    const tagged = await browser.agent.get('/api/documents?tag=exam').expect(200);
    expect(tagged.body).toHaveLength(1);

    const search = await browser.agent.get('/api/documents?q=MEMBRANE').expect(200); // searches the text too
    expect(search.body.map((d: { id: string }) => d.id)).toEqual([cells.body.document.id]);

    const subjects = await browser.agent.get('/api/subjects').expect(200);
    expect(subjects.body[0]).toMatchObject({ name: 'Biology', colour: 'emerald', documentCount: 1 });
  });

  it('keeps documents when their subject is deleted', async () => {
    const { browser } = await signedInUser();
    const subject = await browser.post('/api/subjects', { name: 'Maths' }).expect(201);
    const doc = await browser.upload('algebra.txt', 'x + y', subject.body.id).expect(201);

    await browser.del(`/api/subjects/${subject.body.id}`).expect(204);
    const after = await browser.agent.get(`/api/documents/${doc.body.document.id}`).expect(200);
    expect(after.body.subjectId).toBeNull();
  });

  it('reports storage used', async () => {
    const { browser } = await signedInUser();
    await browser.upload('a.txt', '12345').expect(201);
    const stats = await browser.agent.get('/api/documents/stats').expect(200);
    expect(stats.body).toEqual({ usedBytes: 5, quotaBytes: STORAGE_QUOTA_BYTES, documentCount: 1 });
  });
});

describe("one user can't reach another user's library", () => {
  it("returns 404 for every action on someone else's document or subject", async () => {
    const alice = await signedInUser();
    const bob = await signedInUser();
    const subject = await alice.browser.post('/api/subjects', { name: 'Private' }).expect(201);
    const doc = await alice.browser.upload('secret.txt', 'Alice only', subject.body.id).expect(201);
    const docUrl = `/api/documents/${doc.body.document.id}`;

    await bob.browser.agent.get(docUrl).expect(404);
    await bob.browser.agent.get(`${docUrl}/text`).expect(404);
    await bob.browser.agent.get(`${docUrl}/file`).expect(404);
    await bob.browser.patch(docUrl, { title: 'Hacked' }).expect(404);
    await bob.browser.post(`${docUrl}/retry`).expect(404);
    await bob.browser.del(docUrl).expect(404);

    // Bob can't use Alice's subject, either for uploads or for his own documents.
    await bob.browser.upload('mine.txt', 'Bob text', subject.body.id).expect(404);
    const bobs = await bob.browser.upload('bob.txt', 'Bob text 2').expect(201);
    await bob.browser
      .patch(`/api/documents/${bobs.body.document.id}`, { subjectId: subject.body.id })
      .expect(404);
    await bob.browser.patch(`/api/subjects/${subject.body.id}`, { name: 'Mine now' }).expect(404);
    await bob.browser.del(`/api/subjects/${subject.body.id}`).expect(404);

    expect((await bob.browser.agent.get('/api/documents').expect(200)).body).toHaveLength(1);
    expect((await bob.browser.agent.get('/api/subjects').expect(200)).body).toHaveLength(0);

    // Alice's things are untouched.
    const still = await alice.browser.agent.get(docUrl).expect(200);
    expect(still.body).toMatchObject({ title: 'secret', subjectId: subject.body.id });
  });
});
