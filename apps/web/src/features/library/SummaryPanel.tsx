// The "AI summary" card on a document page: pick a style, ask Gemini, read the result.
// AI output is shown as plain text (React escapes it), never as HTML, so a summary can't
// inject scripts into the page. See docs/11-ai-gemini.md.
import { SUMMARY_STYLE_LABELS, SUMMARY_STYLES, type SummaryDto, type SummaryStyle } from '@studyapp/shared';
import { Check, Copy, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, IconTile } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { errorMessage } from '../../lib/api';
import { formatDate } from './format';
import { useDocumentSummaries, useRequestSummary } from './useSummaries';

function SummaryView({ summary }: { summary: SummaryDto }) {
  const [copied, setCopied] = useState(false);
  const asText = [
    ...summary.points.map((p) => (summary.style === 'BULLETS' ? `• ${p}` : p)),
    '',
    ...summary.keyTerms.map((k) => `${k.term}: ${k.definition}`),
  ].join('\n');

  const copy = async () => {
    await navigator.clipboard.writeText(asText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {summary.style === 'BULLETS' ? (
        <ul className="list-disc space-y-1.5 pl-5 leading-relaxed marker:text-brand-500">
          {summary.points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3 leading-relaxed">
          {summary.points.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {summary.keyTerms.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-extrabold tracking-wide text-muted uppercase">Key terms</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {summary.keyTerms.map((k) => (
              <div key={k.term} className="rounded-xl border-2 border-line bg-raised p-3">
                <dt className="font-display font-extrabold">{k.term}</dt>
                <dd className="mt-0.5 text-sm text-muted">{k.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span>
          Written by {summary.model} on {formatDate(summary.createdAt)}. AI can make mistakes, so check it
          against your guide.
        </span>
        <Button variant="ghost" size="sm" onClick={() => void copy()}>
          {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function Writing() {
  return (
    <div role="status" className="space-y-3">
      <p className="flex items-center gap-2 font-semibold">
        <Sparkles aria-hidden className="size-4 animate-pulse text-grape" /> Reading your guide…
      </p>
      <p className="text-sm text-muted">
        This usually takes 5 to 30 seconds. You can leave this page; it keeps going.
      </p>
      <div aria-hidden className="space-y-2">
        {[92, 84, 88, 60].map((w) => (
          <div key={w} className="h-3 animate-pulse rounded-full bg-line" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

export function SummaryPanel({ documentId, ready }: { documentId: string; ready: boolean }) {
  const summaries = useDocumentSummaries(documentId);
  const request = useRequestSummary(documentId);
  const [chosen, setChosen] = useState<SummaryStyle | null>(null);

  const data = summaries.data;
  // Until you pick a tab, show the first style that already has a summary.
  const style = chosen ?? data?.summaries[0]?.style ?? 'BRIEF';
  const summary = data?.summaries.find((s) => s.style === style);
  const job = data?.jobs.find((j) => j.style === style);
  const working = job?.status === 'QUEUED' || job?.status === 'RUNNING' || request.isPending;
  const usage = data?.usage;
  const left = usage ? Math.max(0, usage.limit - usage.used) : 0;

  return (
    <Card
      icon={<IconTile className="bg-[#f5e8ff] text-grape dark:bg-[#2e1a3d]">✨</IconTile>}
      title="AI summary"
      description="Key points and key terms from this guide, written by Google Gemini."
    >
      <div
        role="tablist"
        aria-label="Summary style"
        className="mb-5 flex flex-wrap gap-1 rounded-xl bg-hover p-1"
      >
        {SUMMARY_STYLES.map((s) => {
          const done = data?.summaries.some((x) => x.style === s);
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={style === s}
              onClick={() => setChosen(s)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                style === s ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {SUMMARY_STYLE_LABELS[s].label}
              {done && <span className="ml-1 text-brand-500">•</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-label={SUMMARY_STYLE_LABELS[style].label}>
        {summaries.isPending && <p className="text-sm text-muted">Loading…</p>}
        {summaries.isError && <Alert tone="error">{errorMessage(summaries.error)}</Alert>}

        {data && summary && <SummaryView summary={summary} />}
        {data && !summary && working && <Writing />}

        {data && !summary && !working && (
          <div className="space-y-4">
            {job?.status === 'FAILED' && (
              <Alert tone="error">{job.error ?? 'The summary failed. Try again.'}</Alert>
            )}
            {request.isError && <Alert tone="error">{errorMessage(request.error)}</Alert>}
            {!data.usage.enabled ? (
              <Alert tone="info">
                AI isn&apos;t set up yet. Add your free Gemini key to <code>.env</code> as{' '}
                <code>GEMINI_API_KEY</code> and restart the API.
              </Alert>
            ) : (
              <>
                {left === 0 && (
                  <Alert tone="warning">
                    You&apos;ve used all {data.usage.limit} AI requests for the last 24 hours. Summaries
                    you&apos;ve already made still open.
                  </Alert>
                )}
                <p className="text-sm text-muted">{SUMMARY_STYLE_LABELS[style].hint}.</p>
                <Button onClick={() => request.mutate(style)} disabled={!ready || left === 0}>
                  <Sparkles aria-hidden className="size-4" />
                  {job?.status === 'FAILED' ? 'Try again' : `Summarise: ${SUMMARY_STYLE_LABELS[style].label}`}
                </Button>
                <p className="text-xs text-muted">
                  {ready
                    ? "Sends this guide's text to Google Gemini's free tier. Don't use it for personal or confidential material."
                    : 'You can summarise this guide once its text has been read.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {usage?.enabled && (
        <div className="mt-6 border-t border-line pt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted">
            <span>AI requests in the last 24 hours</span>
            <span className="font-semibold">
              {usage.used} of {usage.limit}
            </span>
          </div>
          <ProgressBar
            value={usage.used}
            max={usage.limit}
            label="AI requests used"
            colour="bg-grape"
            size="sm"
          />
          <p className="mt-1.5 text-xs text-muted">
            Summaries you&apos;ve already made are free to open again.
          </p>
        </div>
      )}
    </Card>
  );
}
