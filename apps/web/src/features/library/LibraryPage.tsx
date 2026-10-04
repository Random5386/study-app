// The study guide library: subjects on the left; search, upload and the document list on the right.
// The selected subject and the search text live in the URL (?subject=...&q=...),
// so the browser's back button and bookmarks work.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { PageHeader } from '../../components/ui/PageHeader';
import { useLevelWords } from '../../components/useLevelWords';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { inputClass } from '../../components/ui/TextField';
import { errorMessage } from '../../lib/api';
import { fileEmoji, fileKind, formatBytes, timeAgo } from './format';
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
  const words = useLevelWords();
  const stats = useLibraryStats();
  const subjectName = (id: string | null) => subjects.data?.find((s) => s.id === id)?.name;
  const heading =
    subjectId === 'none'
      ? `Not in a ${words.subject}`
      : subjectId
        ? (subjectName(subjectId) ?? words.Subject)
        : 'All documents';

  return (
    <div>
      <PageHeader
        emoji="📚"
        title="Study guides"
        description={`Everything you upload lives here. Sort guides into ${words.subjects} and tag them for ${words.test}s.`}
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <SubjectList selected={subjectId} onSelect={(id) => update({ subject: id, tag: undefined })} />
          {stats.data && (
            <div className="mt-6 rounded-xl border-2 border-line p-3">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">Storage</p>
              <div className="mt-2">
                <ProgressBar
                  value={stats.data.usedBytes}
                  max={stats.data.quotaBytes}
                  label="Storage used"
                  colour="bg-sky"
                  size="sm"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {formatBytes(stats.data.usedBytes)} of {formatBytes(stats.data.quotaBytes)} used
              </p>
            </div>
          )}
        </aside>

        <section className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">{heading}</h2>
            <div className="relative w-full sm:w-72">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              />
              <input
                type="search"
                aria-label="Search documents"
                placeholder="Search titles and text…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} border-line py-2 pl-9`}
              />
            </div>
          </div>

          {tag && (
            <p className="flex items-center gap-2 text-sm">
              Tagged <Badge tone="purple">#{tag}</Badge>
              <button
                type="button"
                className="font-semibold text-link hover:underline"
                onClick={() => update({ tag: undefined })}
              >
                Clear
              </button>
            </p>
          )}

          <UploadDropzone subjectId={subjectId && subjectId !== 'none' ? subjectId : undefined} />

          {documents.isPending && <p className="text-sm text-muted">Loading…</p>}
          {documents.isError && <Alert tone="error">{errorMessage(documents.error)}</Alert>}
          {documents.data?.length === 0 && (
            <p className="rounded-2xl border-2 border-line p-8 text-center text-muted">
              {q || tag
                ? 'No documents match. Try another search. 🔍'
                : 'No study guides here yet. Upload your first one above.'}
            </p>
          )}

          {documents.data && documents.data.length > 0 && (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
              {documents.data.map((d) => (
                <li key={d.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-hover">
                  <span aria-hidden className="text-2xl" title={fileKind(d.mimeType)}>
                    {fileEmoji(d.mimeType)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/documents/${d.id}`} className="font-semibold hover:underline">
                      {d.title}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {subjectName(d.subjectId) && `${subjectName(d.subjectId)} · `}
                      {formatBytes(d.sizeBytes)}
                      {d.pageCount ? ` · ${d.pageCount} pages` : ''}
                      {d.wordCount ? ` · ${d.wordCount.toLocaleString()} words` : ''} · {timeAgo(d.createdAt)}
                    </p>
                    {d.tags.length > 0 && (
                      <p className="mt-1.5 flex flex-wrap gap-1">
                        {d.tags.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => update({ tag: t })}
                            className="rounded-full"
                          >
                            <Badge tone="purple" className="hover:opacity-80">
                              #{t}
                            </Badge>
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
    </div>
  );
}
