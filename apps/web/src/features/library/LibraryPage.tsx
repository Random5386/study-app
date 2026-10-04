// The study guide library: subjects on the left; search, upload and the document list on the right.
// The selected subject and the search text live in the URL (?subject=...&q=...),
// so the browser's back button and bookmarks work.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { errorMessage } from '../../lib/api';
import { fileKind, formatBytes, formatDate } from './format';
import { StatusBadge } from './StatusBadge';
import { SubjectList } from './SubjectList';
import { UploadDropzone } from './UploadDropzone';
import { useDocuments, useLibraryStats, useSubjects } from './useLibrary';

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subject') ?? undefined;
  const q = params.get('q') ?? '';
  const tag = params.get('tag') ?? undefined;
  const [search, setSearch] = useState(q);

  // Wait until typing pauses before searching, instead of a request per key press.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== q) update({ q: search || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the search box
  }, [search]);

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  }

  const documents = useDocuments({ subjectId, q: q || undefined, tag });
  const subjects = useSubjects();
  const stats = useLibraryStats();
  const subjectName = (id: string | null) => subjects.data?.find((s) => s.id === id)?.name;
  const heading =
    subjectId === 'none'
      ? 'Not in a subject'
      : subjectId
        ? (subjectName(subjectId) ?? 'Subject')
        : 'All documents';

  return (
    <div className="flex gap-8">
      <aside className="w-52 shrink-0">
        <SubjectList selected={subjectId} onSelect={(id) => update({ subject: id, tag: undefined })} />
      </aside>

      <section className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{heading}</h1>
            {stats.data && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatBytes(stats.data.usedBytes)} of {formatBytes(stats.data.quotaBytes)} used
              </p>
            )}
          </div>
          <input
            type="search"
            aria-label="Search documents"
            placeholder="Search titles and text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>

        {tag && (
          <p className="text-sm">
            Tagged <strong>#{tag}</strong>{' '}
            <button
              type="button"
              className="text-indigo-600 underline dark:text-indigo-400"
              onClick={() => update({ tag: undefined })}
            >
              clear
            </button>
          </p>
        )}

        <UploadDropzone subjectId={subjectId && subjectId !== 'none' ? subjectId : undefined} />

        {documents.isPending && <p className="text-sm">Loading…</p>}
        {documents.isError && <Alert tone="error">{errorMessage(documents.error)}</Alert>}
        {documents.data?.length === 0 && (
          <p className="rounded-lg border border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-800">
            {q || tag ? 'No documents match.' : 'No study guides here yet. Upload your first one above.'}
          </p>
        )}

        {documents.data && documents.data.length > 0 && (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {documents.data.map((d) => (
              <li key={d.id} className="flex items-center gap-4 px-4 py-3">
                <span className="w-12 shrink-0 rounded bg-slate-100 py-1 text-center text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {fileKind(d.mimeType)}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/documents/${d.id}`} className="font-medium hover:underline">
                    {d.title}
                  </Link>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {subjectName(d.subjectId) && `${subjectName(d.subjectId)} · `}
                    {formatBytes(d.sizeBytes)}
                    {d.pageCount ? ` · ${d.pageCount} pages` : ''}
                    {d.wordCount ? ` · ${d.wordCount.toLocaleString()} words` : ''} ·{' '}
                    {formatDate(d.createdAt)}
                  </p>
                  {d.tags.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {d.tags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => update({ tag: t })}
                          className="rounded bg-slate-100 px-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        >
                          #{t}
                        </button>
                      ))}
                    </p>
                  )}
                </div>
                <StatusBadge status={d.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
