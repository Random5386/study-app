// Test helpers: render the real routes at a given URL, with a fake API.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { setCsrfToken } from '../lib/api';
import { routes } from '../routes';

type FakeRoute = { status: number; body?: unknown };
/** Map of "METHOD /path" → response, e.g. { 'GET /api/auth/me': { status: 401 } } */
export type FakeApi = Record<string, FakeRoute | ((body: unknown) => FakeRoute)>;

export function mockApi(fake: FakeApi) {
  const calls: { method: string; path: string; body: unknown; headers: Headers }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = String(input);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body, headers: new Headers(init?.headers) });
    const handler = fake[`${method} ${path}`];
    if (!handler)
      return new Response(JSON.stringify({ error: `No fake for ${method} ${path}` }), { status: 500 });
    const { status, body: resBody } = typeof handler === 'function' ? handler(body) : handler;
    return new Response(status === 204 ? null : JSON.stringify(resBody ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return calls;
}

export function renderApp(url: string) {
  setCsrfToken(null);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
