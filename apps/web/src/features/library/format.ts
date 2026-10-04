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

export const STATUS_STYLE: Record<DocumentStatus, { label: string; className: string }> = {
  PROCESSING: {
    label: 'Processing…',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  READY: {
    label: 'Ready',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
};
