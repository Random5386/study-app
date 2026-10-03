// Component tests: render the component, fake the network, check what the user sees.
// See docs/15-testing.md.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HealthStatus } from './HealthStatus';

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockFetch(status: number, body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('HealthStatus', () => {
  it('shows the API and database as up', async () => {
    mockFetch(200, { ok: true, app: 'StudyApp', database: 'up', time: new Date().toISOString() });
    renderWithQuery(<HealthStatus />);

    expect(await screen.findByText('API: StudyApp is running')).toBeInTheDocument();
    expect(screen.getByText('Database: connected')).toBeInTheDocument();
  });

  it('tells you how to fix a stopped database', async () => {
    mockFetch(503, { ok: false, app: 'StudyApp', database: 'down', time: new Date().toISOString() });
    renderWithQuery(<HealthStatus />);

    expect(await screen.findByText('API: StudyApp is running')).toBeInTheDocument();
    expect(screen.getByText(/Database: down\. Run `docker compose up -d`/)).toBeInTheDocument();
  });

  it('explains what to do when the API is not running', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    renderWithQuery(<HealthStatus />);

    expect(await screen.findByText(/Is `npm run dev` running\?/)).toBeInTheDocument();
  });
});
