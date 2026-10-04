// The AI summary card on a document page, with the API faked.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { DocumentDetail, DocumentSummariesResponse, SummaryDto } from '@studyapp/shared';
import { signedInFakes } from '../../test/fixtures';
import { mockApi, renderApp } from '../../test/renderApp';

const doc: DocumentDetail = {
  id: 'd1',
  title: 'Cells',
  originalName: 'cells.txt',
  mimeType: 'text/plain',
  sizeBytes: 2000,
  status: 'READY',
  failureReason: null,
  pageCount: null,
  wordCount: 300,
  subjectId: null,
  tags: [],
  createdAt: '2026-10-04T10:00:00.000Z',
  updatedAt: '2026-10-04T10:00:00.000Z',
  textPreview: 'Cells are the basic unit of life.',
  textLength: 33,
};

const summary: SummaryDto = {
  id: 's1',
  style: 'BULLETS',
  audience: 'UNIVERSITY',
  points: ['Cells are the basic unit of life.', 'Mitochondria release energy.'],
  keyTerms: [{ term: 'Mitochondria', definition: 'The part of the cell that releases energy.' }],
  model: 'gemini-test',
  createdAt: '2026-10-04T10:05:00.000Z',
};

const usage = { enabled: true, used: 0, limit: 20, resetsAt: null };
const none: DocumentSummariesResponse = { summaries: [], jobs: [], usage };

function fakes(summaries: () => DocumentSummariesResponse, onPost?: (body: unknown) => void) {
  return mockApi({
    ...signedInFakes(),
    'GET /api/documents/d1': { status: 200, body: doc },
    'GET /api/documents/d1/summaries': () => ({ status: 200, body: summaries() }),
    'POST /api/documents/d1/summaries': (body) => {
      onPost?.(body);
      return {
        status: 202,
        body: {
          cached: false,
          job: { id: 'j1', status: 'QUEUED', style: 'BULLETS', error: null, summaryId: null, createdAt: '' },
        },
      };
    },
  });
}

describe('AI summary card', () => {
  it('asks for the chosen style and shows the finished summary', async () => {
    let state = none;
    const calls = fakes(
      () => state,
      () => {
        state = { summaries: [summary], jobs: [], usage: { ...usage, used: 1 } };
      },
    );
    renderApp('/documents/d1');

    await userEvent.click(await screen.findByRole('tab', { name: /Bullet points/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Summarise: Bullet points' }));

    expect(await screen.findByText('Mitochondria release energy.')).toBeInTheDocument();
    expect(screen.getByText('Mitochondria')).toBeInTheDocument(); // key term
    expect(screen.getByText('1 of 20')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ style: 'BULLETS' });
  });

  it('shows progress while the summary is being written', async () => {
    fakes(() => ({
      ...none,
      jobs: [{ id: 'j1', status: 'RUNNING', style: 'BRIEF', error: null, summaryId: null, createdAt: '' }],
    }));
    renderApp('/documents/d1');
    expect(await screen.findByText('Reading your guide…')).toBeInTheDocument();
  });

  it('explains a failure and offers to try again', async () => {
    fakes(() => ({
      ...none,
      jobs: [
        {
          id: 'j1',
          status: 'FAILED',
          style: 'BRIEF',
          error: 'Gemini is busy.',
          summaryId: null,
          createdAt: '',
        },
      ],
    }));
    renderApp('/documents/d1');
    expect(await screen.findByText('Gemini is busy.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('explains how to turn AI on when there is no key', async () => {
    fakes(() => ({ ...none, usage: { ...usage, enabled: false } }));
    renderApp('/documents/d1');
    await waitFor(() => expect(screen.getByText(/isn.t set up yet/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Summarise/ })).not.toBeInTheDocument();
  });

  it('shows AI text as plain text, never as HTML', async () => {
    const sneaky = { ...summary, style: 'BRIEF' as const, points: ['<img src=x onerror="alert(1)">'] };
    fakes(() => ({ ...none, summaries: [sneaky] }));
    renderApp('/documents/d1');
    expect(await screen.findByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
