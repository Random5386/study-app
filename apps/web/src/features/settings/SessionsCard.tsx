import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActiveSession } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { api, errorMessage } from '../../lib/api';
import { describeDevice, formatDateTime } from './describeDevice';

const SESSIONS_KEY = ['account', 'sessions'];

export function SessionsCard() {
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => api.get<ActiveSession[]>('/api/account/sessions'),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['account'] });

  const revokeOne = useMutation({
    mutationFn: (id: string) => api.delete(`/api/account/sessions/${id}`),
    onSuccess: refresh,
  });
  const revokeOthers = useMutation({
    mutationFn: () => api.post<{ revoked: number }>('/api/account/sessions/revoke-others'),
    onSuccess: refresh,
  });

  const others = sessions.data?.filter((s) => !s.current) ?? [];

  return (
    <Card
      title="Active sessions"
      description="Devices signed in to your account. Sign out any you don't recognise."
    >
      {sessions.isPending && <p className="text-sm">Loading…</p>}
      {sessions.isError && <Alert tone="error">{errorMessage(sessions.error)}</Alert>}
      {(revokeOne.isError || revokeOthers.isError) && (
        <Alert tone="error">{errorMessage(revokeOne.error ?? revokeOthers.error)}</Alert>
      )}
      {sessions.data && (
        <ul className="divide-y divide-line">
          {sessions.data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {describeDevice(s.userAgent)}
                  {s.current && (
                    <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-muted">
                  {s.ipAddress ?? 'Unknown IP'} · last active {formatDateTime(s.lastSeenAt)}
                </p>
              </div>
              {!s.current && (
                <Button
                  variant="secondary"
                  onClick={() => revokeOne.mutate(s.id)}
                  loading={revokeOne.isPending && revokeOne.variables === s.id}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => revokeOthers.mutate()}
          loading={revokeOthers.isPending}
        >
          Sign out all other devices
        </Button>
      )}
    </Card>
  );
}
