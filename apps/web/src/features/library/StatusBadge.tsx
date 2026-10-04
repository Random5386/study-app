import type { DocumentStatus } from '@studyapp/shared';
import { Badge } from '../../components/ui/Badge';
import { STATUS_STYLE } from './format';

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { label, tone } = STATUS_STYLE[status];
  return <Badge tone={tone}>{label}</Badge>;
}
