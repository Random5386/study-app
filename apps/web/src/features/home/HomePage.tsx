import { HealthStatus } from './HealthStatus';

export function HomePage() {
  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold">Welcome to StudyApp</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Phase 1 is set up: the React app, the Express API and the PostgreSQL database are wired together.
        Accounts and sign-in arrive in phase 2.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 font-semibold">System status</h2>
        <HealthStatus />
      </div>
    </section>
  );
}
