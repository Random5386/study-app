import type { DocumentStatus, SubjectColour } from '@studyapp/shared';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

/** Short label for a file type, e.g. "PDF". */
export function fileKind(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('wordprocessingml')) return 'DOCX';
  if (mimeType === 'text/markdown') return 'MD';
  return 'TXT';
}

// Tailwind needs full class names written out, so it can find them when building the CSS.
export const SUBJECT_DOT: Record<SubjectColour, string> = {
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-500',
};

export const STATUS_STYLE: Record<DocumentStatus, { label: string; tone: 'orange' | 'green' | 'red' }> = {
  PROCESSING: { label: 'Processing…', tone: 'orange' },
  READY: { label: 'Ready', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
};

/** An emoji for each file type, used as the document's "page icon" (Notion style). */
export function fileEmoji(mimeType: string): string {
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('wordprocessingml')) return '📘';
  if (mimeType === 'text/markdown') return '📗';
  return '📄';
}

/** "just now", "5 min ago", "3 days ago", then a date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return formatDate(iso);
}
