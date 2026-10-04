import type { DocumentStatus } from '@studyapp/shared';
import { STATUS_STYLE } from './format';

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { label, className } = STATUS_STYLE[status];
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
