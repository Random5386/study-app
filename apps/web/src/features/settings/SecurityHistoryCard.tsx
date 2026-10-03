import { useQuery } from '@tanstack/react-query';
import type { AuditEntry } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { api, errorMessage } from '../../lib/api';
import { describeDevice, formatDateTime } from './describeDevice';

// Friendly wording for each event the API records.
const EVENT_TEXT: Record<string, string> = {
  REGISTERED: 'Account created',
  EMAIL_VERIFIED: 'Email confirmed',
  LOGIN: 'Signed in',
  LOGIN_FAILED: 'Failed sign-in attempt',
  ACCOUNT_LOCKED: 'Account locked after failed attempts',
  LOGOUT: 'Signed out',
  MFA_ENABLED: 'Two-factor sign-in turned on',
  MFA_DISABLED: 'Two-factor sign-in turned off',
  MFA_FAILED: 'Wrong two-factor code',
  RECOVERY_CODE_USED: 'Recovery code used',
  PASSWORD_CHANGED: 'Password changed',
  PASSWORD_RESET_REQUESTED: 'Password reset requested',
  PASSWORD_RESET: 'Password reset',
  SESSIONS_REVOKED: 'Other devices signed out',
};

const WARNING_EVENTS = new Set(['LOGIN_FAILED', 'ACCOUNT_LOCKED', 'MFA_FAILED']);

export function SecurityHistoryCard() {
  const history = useQuery({
    queryKey: ['account', 'security-history'],
    queryFn: () => api.get<AuditEntry[]>('/api/account/security-history'),
  });

  return (
    <Card
      title="Security history"
      description="Your last 50 security events. Something you don't recognise? Change your password."
    >
      {history.isPending && <p className="text-sm">Loading…</p>}
      {history.isError && <Alert tone="error">{errorMessage(history.error)}</Alert>}
      {history.data && (
        <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
          {history.data.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 py-2">
              <span className={WARNING_EVENTS.has(e.event) ? 'text-amber-700 dark:text-amber-400' : ''}>
                {EVENT_TEXT[e.event] ?? e.event}
              </span>
              <span className="text-right text-slate-500 dark:text-slate-400">
                {formatDateTime(e.createdAt)}
                <br />
                <span className="text-xs">
                  {describeDevice(e.userAgent)} · {e.ipAddress ?? 'unknown IP'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
