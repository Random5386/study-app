// Shows whether the API and database are reachable.
// Every screen that loads data handles three states: loading, error, success.
import { useHealth } from './useHealth';

export function HealthStatus() {
  const health = useHealth();

  if (health.isPending) {
    return <StatusRow tone="neutral" label="Checking the API…" />;
  }
  if (health.isError) {
    return <StatusRow tone="bad" label="API unreachable. Is `npm run dev` running?" />;
  }
  return (
    <ul className="space-y-2">
      <li>
        <StatusRow tone="good" label={`API: ${health.data.app} is running`} />
      </li>
      <li>
        <StatusRow
          tone={health.data.database === 'up' ? 'good' : 'bad'}
          label={
            health.data.database === 'up'
              ? 'Database: connected'
              : 'Database: down. Run `docker compose up -d`'
          }
        />
      </li>
    </ul>
  );
}

type Tone = 'good' | 'bad' | 'neutral';
const DOT: Record<Tone, string> = {
  good: 'bg-brand-500',
  bad: 'bg-coral',
  neutral: 'bg-line-strong',
};

function StatusRow({ tone, label }: { tone: Tone; label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm" role="status">
      <span className={`inline-block size-2.5 rounded-full ${DOT[tone]}`} aria-hidden="true" />
      {label}
    </p>
  );
}
