// The library page with the API faked: listing, filtering by subject, and uploading.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DocumentSummary, SubjectDto } from '@studyapp/shared';
import { mockApi, renderApp } from '../../test/renderApp';

const user = {
  id: 'u1',
  email: 'ada@test.dev',
  displayName: 'Ada',
  emailVerified: true,
  mfaEnabled: true,
  createdAt: new Date().toISOString(),
};
const biology: SubjectDto = {
  id: '0192f3a0-0000-7000-8000-00000000000b',
  name: 'Biology',
  colour: 'emerald',
  position: 0,
  documentCount: 1,
};
const doc = (over: Partial<DocumentSummary>): DocumentSummary => ({
  id: 'd1',
  title: 'Cells',
  originalName: 'Cells.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 20480,
  status: 'READY',
  failureReason: null,
  pageCount: 3,
  wordCount: 1200,
  subjectId: biology.id,
  tags: ['exam'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

const base = {
  'GET /api/auth/session': { status: 200, body: { user, mfaPending: false } },
  'GET /api/auth/csrf': { status: 200, body: { csrfToken: 't' } },
  'GET /api/subjects': { status: 200, body: [biology] },
  'GET /api/documents/stats': {
    status: 200,
    body: { usedBytes: 20480, quotaBytes: 52428800, documentCount: 1 },
  },
};

describe('library page', () => {
  it('lists documents with their subject, details and status', async () => {
    mockApi({
      ...base,
      'GET /api/documents': {
        status: 200,
        body: [doc({}), doc({ id: 'd2', title: 'Scan', status: 'FAILED', subjectId: null, tags: [] })],
      },
    });
    renderApp('/documents');

    expect(await screen.findByRole('link', { name: 'Cells' })).toHaveAttribute('href', '/documents/d1');
    expect(screen.getByText(/Biology · 20 KB · 3 pages · 1,200 words/)).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('20 KB of 50.0 MB used')).toBeInTheDocument();
  });

  it('filters by subject using the URL', async () => {
    const calls = mockApi({
      ...base,
      'GET /api/documents': { status: 200, body: [] },
      [`GET /api/documents?subjectId=${biology.id}`]: { status: 200, body: [doc({})] },
    });
    const { router } = renderApp('/documents');

    const subjects = await screen.findByRole('navigation', { name: 'Subjects' });
    await userEvent.click(await within(subjects).findByRole('button', { name: /^Biology\s*1$/ }));

    expect(await screen.findByRole('heading', { name: 'Biology' })).toBeInTheDocument();
    expect(router.state.location.search).toBe(`?subject=${biology.id}`);
    expect(calls.some((c) => c.path === `/api/documents?subjectId=${biology.id}`)).toBe(true);
  });

  it('uploads a chosen file with the CSRF header and shows the result', async () => {
    let uploaded = false;
    const calls = mockApi({
      ...base,
      'GET /api/documents': () => ({
        status: 200,
        body: uploaded ? [doc({ title: 'notes', status: 'PROCESSING' })] : [],
      }),
      'POST /api/documents': () => {
        uploaded = true;
        return { status: 201, body: { duplicate: false, document: doc({ title: 'notes' }) } };
      },
    });
    renderApp('/documents');

    const input = await screen.findByLabelText('Choose files to upload');
    await userEvent.upload(input, new File(['Osmosis moves water'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Processing…')).toBeInTheDocument());

    const post = calls.find((c) => c.method === 'POST' && c.path === '/api/documents');
    expect(post?.headers.get('X-CSRF-Token')).toBe('t');
  });
});
