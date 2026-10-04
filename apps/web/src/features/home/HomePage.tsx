// Home: a friendly greeting, a snapshot of your library, and what to study next.
// Calm layout (Notion), playful details (Duolingo): emoji, chunky cards, friendly copy.
import type { DocumentSummary } from '@studyapp/shared';
import { ArrowRight, Sparkles, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { buttonClass } from '../../components/ui/buttonClass';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useMe } from '../auth/useMe';
import { fileEmoji, formatBytes, timeAgo } from '../library/format';
import { StatusBadge } from '../library/StatusBadge';
import { useDocuments, useLibraryStats, useSubjects } from '../library/useLibrary';
import { HealthStatus } from './HealthStatus';

function greeting(hour = new Date().getHours()) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

type StatCardProps = { emoji: string; value: ReactNode; label: string; accent: string; children?: ReactNode };

function StatCard({ emoji, value, label, accent, children }: StatCardProps) {
  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span
          aria-hidden
          className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl sm:size-11 sm:text-2xl ${accent}`}
        >
          {emoji}
        </span>
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight font-black">{value}</p>
          <p className="text-sm text-muted">{label}</p>
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function RecentGuides({ docs }: { docs: DocumentSummary[] | undefined }) {
  if (!docs) return <div className="h-48 rounded-2xl border-2 border-line" aria-hidden />;
  if (docs.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line-strong p-8 text-center">
        <p aria-hidden className="text-4xl">
          📚
        </p>
        <p className="mt-2 font-display text-lg font-black">Your library is empty</p>
        <p className="mt-1 text-sm text-muted">Upload a PDF, Word or text file to get started.</p>
        <Link to="/documents" className={buttonClass('primary', 'md', 'mt-4')}>
          Upload a guide
        </Link>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border-2 border-line bg-surface">
      {docs.slice(0, 5).map((doc) => (
        <li key={doc.id}>
          <Link
            to={`/documents/${doc.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-hover"
          >
            <span aria-hidden className="text-2xl">
              {fileEmoji(doc.mimeType)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{doc.title}</span>
              <span className="block text-xs text-muted">Added {timeAgo(doc.createdAt)}</span>
            </span>
            {doc.status !== 'READY' && <StatusBadge status={doc.status} />}
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const { data: me } = useMe();
  const { data: docs } = useDocuments({});
  const { data: stats } = useLibraryStats();
  const { data: subjects } = useSubjects();
  const firstName = me?.displayName.split(' ')[0] ?? '';

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-black sm:text-4xl">
          {greeting()}, {firstName} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 text-lg text-muted">What are we studying today?</p>
      </header>

      <section aria-label="Your library" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          emoji="📚"
          accent="bg-[#ddf4ff] dark:bg-[#0f2a3a]"
          value={stats?.documentCount ?? '–'}
          label={stats?.documentCount === 1 ? 'study guide' : 'study guides'}
        />
        <StatCard
          emoji="🗂️"
          accent="bg-[#f5e8ff] dark:bg-[#2e1a3d]"
          value={subjects?.length ?? '–'}
          label={subjects?.length === 1 ? 'subject' : 'subjects'}
        />
        <div className="col-span-2 lg:col-span-1">
          <StatCard
            emoji="💾"
            accent="bg-brand-100 dark:bg-brand-900"
            value={stats ? formatBytes(stats.usedBytes) : '–'}
            label={stats ? `of ${formatBytes(stats.quotaBytes)} storage` : 'storage'}
          >
            <ProgressBar
              value={stats?.usedBytes ?? 0}
              max={stats?.quotaBytes ?? 1}
              label="Storage used"
              colour="bg-sky"
              size="sm"
            />
          </StatCard>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-extrabold">Jump back in</h2>
            <Link to="/documents" className="text-sm font-semibold text-link hover:underline">
              See all
            </Link>
          </div>
          <RecentGuides docs={docs} />
        </section>

        <div className="space-y-4">
          <Link
            to="/documents"
            className="group flex items-center gap-4 rounded-2xl border-2 border-b-[6px] border-brand-600 bg-brand-500 p-4 text-brand-900 transition-transform active:translate-y-[2px] active:border-b-4"
          >
            <span className="grid size-11 place-items-center rounded-xl bg-white/30">
              <Upload aria-hidden className="size-5" />
            </span>
            <span>
              <span className="block font-display text-lg font-black">Upload a guide</span>
              <span className="block text-sm font-semibold text-brand-900/80">
                PDF, Word, text or Markdown
              </span>
            </span>
          </Link>

          <div className="rounded-2xl border-2 border-line bg-surface p-4">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden className="size-4 text-grape" />
              <h2 className="font-extrabold">Coming soon</h2>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              <li>🃏 Flashcards with spaced repetition</li>
              <li>🔥 Mini streaks: get cards right in a row</li>
              <li>📝 Notion-style notes</li>
            </ul>
          </div>

          {me && !me.mfaEnabled && (
            <div className="rounded-2xl border-2 border-fire/50 bg-[#fff6e5] p-4 dark:bg-[#3a2a10]">
              <p className="font-display font-extrabold">
                <span aria-hidden>🛡️</span> Protect your account
              </p>
              <p className="mt-1 text-sm text-muted">Turn on two-factor sign-in. It takes about a minute.</p>
              <Link to="/settings/security" className={buttonClass('secondary', 'sm', 'mt-3')}>
                Turn it on
              </Link>
            </div>
          )}
        </div>
      </div>

      <details className="rounded-2xl border-2 border-line px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-muted">
          System status <Badge className="ml-1">for developers</Badge>
        </summary>
        <div className="mt-3">
          <HealthStatus />
        </div>
      </details>
    </div>
  );
}
