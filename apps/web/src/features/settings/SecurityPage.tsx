// Settings → Security: password, two-factor sign-in, active sessions, security history.
import { ChangePasswordCard } from './ChangePasswordCard';
import { MfaCard } from './MfaCard';
import { SecurityHistoryCard } from './SecurityHistoryCard';
import { SessionsCard } from './SessionsCard';

export function SecurityPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Security</h1>
      <MfaCard />
      <ChangePasswordCard />
      <SessionsCard />
      <SecurityHistoryCard />
    </div>
  );
}
