// One study guide: rename it, file it in a subject, tag it, read its text, download or delete it.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Download, Sparkles, Trash2 } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { buttonClass } from '../../components/ui/buttonClass';
import { Card, IconTile } from '../../components/ui/Card';
import { ApiError, errorMessage } from '../../lib/api';
import { fileEmoji, fileKind, formatBytes, formatDate } from './format';
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

  if (doc.isPending) return <p className="text-sm text-muted">Loading…</p>;
  if (doc.isError) {
    const notFound = doc.error instanceof ApiError && doc.error.status === 404;
    return (
      <Alert tone="error">
        {notFound ? 'That document does not exist.' : errorMessage(doc.error)}{' '}
        <Link to="/documents" className="font-semibold underline">
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
    <article className="max-w-3xl space-y-8">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <Link to="/documents" className="rounded-md px-1.5 py-0.5 hover:bg-hover hover:text-ink">
          📚 Study guides
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-ink">{d.title}</span>
      </nav>

      <header>
        <span aria-hidden className="block text-6xl leading-none">
          {fileEmoji(d.mimeType)}
        </span>
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
          className="mt-4 w-full rounded-lg bg-transparent font-display text-4xl font-black outline-none placeholder:text-muted focus:bg-hover"
        />
      </header>

      {update.isError && <Alert tone="error">{errorMessage(update.error)}</Alert>}

      {/* Notion-style properties: a label column and a value column */}
      <dl className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Status</dt>
        <dd>
          <StatusBadge status={d.status} />
        </dd>

        <dt className="text-muted">
          <label htmlFor="doc-subject">Subject</label>
        </dt>
        <dd>
          <select
            id="doc-subject"
            value={d.subjectId ?? ''}
            onChange={(e) => update.mutate({ subjectId: e.target.value || null })}
            className="-ml-2 max-w-full rounded-lg bg-transparent px-2 py-1 hover:bg-hover focus:bg-hover"
          >
            <option value="">Not in a subject</option>
            {subjects.data?.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </dd>

        <dt className="text-muted">Tags</dt>
        <dd>
          {tagText === null ? (
            <button
              type="button"
              onClick={() => setTagText(d.tags.join(', '))}
              className="-ml-2 flex flex-wrap gap-1 rounded-lg px-2 py-1 text-left hover:bg-hover"
            >
              {d.tags.length ? (
                d.tags.map((t) => (
                  <Badge key={t} tone="purple">
                    #{t}
                  </Badge>
                ))
              ) : (
                <span className="text-muted">Add tags</span>
              )}
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
                className="min-w-0 flex-1 rounded-lg border-2 border-line bg-raised px-2.5 py-1 focus:border-focus focus:outline-none"
              />
              <Button size="sm" onClick={saveTags} loading={update.isPending}>
                Save
              </Button>
            </span>
          )}
        </dd>

        <dt className="text-muted">File</dt>
        <dd>
          {fileKind(d.mimeType)} · {formatBytes(d.sizeBytes)}
          {d.pageCount ? ` · ${d.pageCount} pages` : ''}
          {d.wordCount ? ` · ${d.wordCount.toLocaleString()} words` : ''}
        </dd>

        <dt className="text-muted">Uploaded</dt>
        <dd>{formatDate(d.createdAt)}</dd>
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-line pt-6">
        <a href={`/api/documents/${d.id}/file`} download className={buttonClass('secondary', 'sm')}>
          <Download aria-hidden className="size-4" /> Download
        </a>
        {confirmDelete ? (
          <>
            <Button
              variant="danger"
              size="sm"
              loading={remove.isPending}
              onClick={() => remove.mutate(d.id, { onSuccess: () => navigate('/documents') })}
            >
              Yes, delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden className="size-4" /> Delete
          </Button>
        )}
      </div>

      {d.status === 'FAILED' && (
        <Alert tone="error">
          {d.failureReason}{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
          >
            Try again
          </button>
        </Alert>
      )}
      {d.status === 'PROCESSING' && <Alert tone="info">Reading the text of this file…</Alert>}

      <Card
        icon={<IconTile className="bg-[#f5e8ff] text-grape dark:bg-[#2e1a3d]">✨</IconTile>}
        title="AI summary"
        description="Key points, definitions and likely exam questions. Arrives in phase 4, with AI flashcards in phase 5."
      >
        <Button variant="secondary" disabled>
          <Sparkles aria-hidden className="size-4" /> Summarise (coming soon)
        </Button>
      </Card>

      {d.textPreview && (
        <section>
          <h2 className="text-xl font-extrabold">Text</h2>
          <p className="mt-1 text-sm text-muted">
            {d.textLength > d.textPreview.length
              ? `Showing the first ${d.textPreview.length.toLocaleString()} of ${d.textLength.toLocaleString()} characters.`
              : 'The text we read from this file.'}
          </p>
          <pre className="mt-4 max-h-[32rem] overflow-auto rounded-2xl border-2 border-line bg-raised p-5 font-sans text-[0.95rem] leading-relaxed whitespace-pre-wrap">
            {d.textPreview}
          </pre>
        </section>
      )}
    </article>
  );
}
