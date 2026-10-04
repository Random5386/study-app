// Settings → Security: password, two-factor sign-in, active sessions, security history.
import { ChangePasswordCard } from './ChangePasswordCard';
import { MfaCard } from './MfaCard';
import { SecurityHistoryCard } from './SecurityHistoryCard';
import { SessionsCard } from './SessionsCard';

export function SecurityPage() {
  return (
    <>
      <h2 className="sr-only">Security</h2>
      <MfaCard />
      <ChangePasswordCard />
      <SessionsCard />
      <SecurityHistoryCard />
    </>
  );
}
