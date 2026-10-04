// One study guide: rename it, file it in a subject, tag it, read its text, download or delete it.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError, errorMessage } from '../../lib/api';
import { fileKind, formatBytes, formatDate } from './format';
import { StatusBadge } from './StatusBadge';
import {
  useDeleteDocument,
  useDocument,
  useRetryDocument,
  useSubjects,
  useUpdateDocument,
} from './useLibrary';

export function DocumentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const doc = useDocument(id);
  const subjects = useSubjects();
  const update = useUpdateDocument(id);
  const remove = useDeleteDocument();
  const retry = useRetryDocument(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagText, setTagText] = useState<string | null>(null); // null = not editing

  if (doc.isPending) return <p className="text-sm">Loading…</p>;
  if (doc.isError) {
    const notFound = doc.error instanceof ApiError && doc.error.status === 404;
    return (
      <Alert tone="error">
        {notFound ? 'That document does not exist.' : errorMessage(doc.error)}{' '}
        <Link to="/documents" className="underline">
          Back to the library
        </Link>
      </Alert>
    );
  }
  const d = doc.data;

  const saveTags = () => {
    if (tagText === null) return;
    const tags = tagText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    update.mutate({ tags }, { onSuccess: () => setTagText(null) });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Link to="/documents" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Library
      </Link>

      <div className="space-y-2">
        <label className="sr-only" htmlFor="doc-title">
          Title
        </label>
        <input
          id="doc-title"
          key={d.title} // reset the box when the saved title changes
          defaultValue={d.title}
          onBlur={(e) => {
            const title = e.target.value.trim();
            if (title && title !== d.title) update.mutate({ title });
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="w-full rounded-md border border-transparent bg-transparent px-1 text-2xl font-bold hover:border-slate-300 focus:border-slate-300 dark:hover:border-slate-700"
        />
        <p className="flex flex-wrap items-center gap-2 px-1 text-sm text-slate-600 dark:text-slate-400">
          <StatusBadge status={d.status} />
          <span>
            {fileKind(d.mimeType)} · {formatBytes(d.sizeBytes)}
            {d.pageCount ? ` · ${d.pageCount} pages` : ''}
            {d.wordCount ? ` · ${d.wordCount.toLocaleString()} words` : ''} · uploaded{' '}
            {formatDate(d.createdAt)}
          </span>
        </p>
      </div>

      {update.isError && <Alert tone="error">{errorMessage(update.error)}</Alert>}

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Subject</span>
          <select
            value={d.subjectId ?? ''}
            onChange={(e) => update.mutate({ subjectId: e.target.value || null })}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Not in a subject</option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm">
          <span className="mb-1 block font-medium">Tags</span>
          {tagText === null ? (
            <button
              type="button"
              onClick={() => setTagText(d.tags.join(', '))}
              className="rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-left hover:border-slate-400 dark:border-slate-700"
            >
              {d.tags.length ? d.tags.map((t) => `#${t}`).join(' ') : 'Add tags'}
            </button>
          ) : (
            <span className="flex gap-2">
              <input
                autoFocus
                aria-label="Tags, separated by commas"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTags()}
                placeholder="exam, term 2"
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
              />
              <Button onClick={saveTags} loading={update.isPending}>
                Save
              </Button>
            </span>
          )}
        </div>

        <div className="ml-auto flex gap-2">
          <a
            href={`/api/documents/${d.id}/file`}
            download
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
          >
            Download
          </a>
          {confirmDelete ? (
            <>
              <Button
                variant="danger"
                loading={remove.isPending}
                onClick={() => remove.mutate(d.id, { onSuccess: () => navigate('/documents') })}
              >
                Yes, delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {d.status === 'FAILED' && (
        <Alert tone="error">
          {d.failureReason}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
          >
            Try again
          </button>
        </Alert>
      )}
      {d.status === 'PROCESSING' && <Alert tone="info">Reading the text of this file…</Alert>}

      <Card title="AI summary" description="Summaries and AI flashcards arrive in phase 4 and 5.">
        <p className="text-sm text-slate-500">Coming soon.</p>
      </Card>

      {d.textPreview && (
        <Card
          title="Text"
          description={
            d.textLength > d.textPreview.length
              ? `Showing the first ${d.textPreview.length.toLocaleString()} of ${d.textLength.toLocaleString()} characters.`
              : 'The text we read from this file.'
          }
        >
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {d.textPreview}
          </pre>
        </Card>
      )}
    </div>
  );
}
