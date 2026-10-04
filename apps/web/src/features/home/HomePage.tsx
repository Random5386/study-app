import { Link } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { useMe } from '../auth/useMe';
import { HealthStatus } from './HealthStatus';

export function HomePage() {
  const { data: me } = useMe();

  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {me?.displayName}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Upload your study guides in the library. AI summaries arrive in phase 4.
        </p>
      </div>

      <p>
        <Link
          to="/documents"
          className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Open your library
        </Link>
      </p>

      {me && !me.mfaEnabled && (
        <Alert tone="info">
          Protect your account with two-factor sign-in.{' '}
          <Link to="/settings/security" className="font-medium underline">
            Turn it on
          </Link>
        </Alert>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">System status</h2>
        <HealthStatus />
      </div>
    </section>
  );
}
