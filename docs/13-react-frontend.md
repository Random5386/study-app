# 13. The React front end

## What it is

**React** builds user interfaces out of **components**: functions that take data (**props**) and return what should appear on screen (JSX). When data changes, React re-renders the affected components.

```tsx
type DeckCardProps = { name: string; dueCount: number };

export function DeckCard({ name, dueCount }: DeckCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold">{name}</h3>
      <p>{dueCount} cards due</p>
    </div>
  );
}
```

StudyApp's front end is a **single-page application (SPA)**: the browser loads one HTML page and React swaps views as you navigate, fetching data from `/api` as JSON.

## Why these tools

| Tool                     | Job                                        | Why                                                                   |
| ------------------------ | ------------------------------------------ | --------------------------------------------------------------------- |
| React 19                 | UI components                              | Most-used front-end library in SA job ads                             |
| Vite                     | Dev server + production build              | Instant start, hot reload, simple config                              |
| React Router 7           | Pages and URLs (`/decks/:id`)              | The standard router                                                   |
| TanStack Query 5         | Fetching, caching and updating server data | Handles loading/error states, caching, refetching and polling for you |
| React Hook Form + Zod    | Forms and validation                       | Reuses the **same Zod schemas** as the API (from `@studyapp/shared`)  |
| Tailwind CSS + shadcn/ui | Styling + accessible components            | Copy-in components you own; dark mode built in                        |

Alternatives worth knowing: **Next.js** (React framework with server rendering — great for public, SEO-heavy sites; StudyApp is behind a login so an SPA is simpler), **Angular** (popular in SA banks/enterprises), **Redux** (global state — TanStack Query covers server data, so we don't need it).

## Where it lives

```
apps/web/
├── vite.config.ts
└── src/
    ├── main.tsx                 # entry: providers + router
    ├── routes.tsx               # URL → page
    ├── lib/api.ts               # fetch wrapper (CSRF, errors)
    ├── lib/queryClient.ts
    ├── components/ui/           # shadcn/ui: Button, Dialog, Input...
    └── features/
        ├── auth/                # LoginPage, RegisterPage, MfaVerifyPage, RequireAuth, useMe
        ├── documents/
        ├── notes/
        ├── decks/
        ├── study/
        └── dashboard/
```

Grouping by **feature** (not by "components/", "hooks/", "pages/") keeps everything about decks in one place.

## Core React ideas in 2 minutes

- **State** — data that changes over time inside a component: `const [isFlipped, setIsFlipped] = useState(false);`. Calling `setIsFlipped(true)` re-renders the component.
- **Props** — data passed _into_ a component by its parent. Read-only.
- **Hooks** — functions starting with `use` (`useState`, `useEffect`, `useQuery`). Only call them at the top level of a component, never inside `if`s or loops.
- **Effects** — `useEffect` is for syncing with things outside React (timers, keyboard listeners). Not for fetching data — TanStack Query does that better.
- **Keys** — when rendering lists, give each item a stable `key` (its id) so React can track it.

## The code, explained

### Vite dev proxy — `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { '/api': 'http://localhost:3000' }, // browser talks to :5173; Vite forwards /api to Express
  },
});
```

The browser only ever sees one origin, so cookies and CSRF work exactly as they will in production.

### The API wrapper — `lib/api.ts`

```ts
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
export const setCsrfToken = (token: string) => {
  csrfToken = token;
};

async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const res = await fetch('/api/auth/csrf');
    csrfToken = ((await res.json()) as { csrfToken: string }).csrfToken;
  }
  return csrfToken;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrfToken();

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // file uploads: the browser sets the multipart header
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: payload });
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong', data.details);
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: (url: string) => request<void>('DELETE', url),
};
```

Every component uses `api.*`, so CSRF headers and error handling are written once. After login the server returns a fresh CSRF token (page 08) and the login page calls `setCsrfToken(...)`.

### Who's logged in? — `features/auth/useMe.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';

export type Me = { id: string; email: string; displayName: string; mfaEnabled: boolean };

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<Me>('/api/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null; // not logged in isn't an error
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
```

### Protected pages — `features/auth/RequireAuth.tsx`

```tsx
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from './useMe';

export function RequireAuth() {
  const { data: me, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) return <p className="p-8">Loading…</p>;
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />; // render the child route
}
```

This guard is for **user experience only**. The real protection is on the server (`requireAuth` + per-user queries) — anything in the browser can be bypassed.

### Routes — `routes.tsx`

```tsx
import { createBrowserRouter } from 'react-router';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/mfa', element: <MfaVerifyPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />, // sidebar + top bar around every page below
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'documents', element: <DocumentsPage /> },
          { path: 'documents/:id', element: <DocumentPage /> },
          { path: 'notes/:id', element: <NotePage /> },
          { path: 'decks', element: <DecksPage /> },
          { path: 'decks/:id', element: <DeckPage /> },
          { path: 'study', element: <StudySession /> },
          { path: 'settings/security', element: <SecuritySettingsPage /> },
        ],
      },
    ],
  },
]);
```

### Reading and changing data — `features/decks/DecksPage.tsx`

```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createDeckSchema, type CreateDeckInput } from '@studyapp/shared';
import { api } from '../../lib/api';

type Deck = { id: string; name: string; _count: { cards: number } };

export function DecksPage() {
  const queryClient = useQueryClient();

  // READ: TanStack Query fetches, caches and tracks loading/error for us.
  const decks = useQuery({ queryKey: ['decks'], queryFn: () => api.get<Deck[]>('/api/decks') });

  // WRITE: after a successful create, mark the list stale so it refetches.
  const createDeck = useMutation({
    mutationFn: (input: CreateDeckInput) => api.post<Deck>('/api/decks', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['decks'] }),
  });

  // FORM: the same Zod schema the API uses, so the rules can't drift apart.
  const form = useForm<CreateDeckInput>({ resolver: zodResolver(createDeckSchema) });

  if (decks.isLoading) return <p>Loading decks…</p>;
  if (decks.isError) return <p role="alert">Couldn't load your decks.</p>;

  return (
    <section>
      <h1 className="text-2xl font-bold">Decks</h1>

      <form
        onSubmit={form.handleSubmit((values) => createDeck.mutate(values, { onSuccess: () => form.reset() }))}
      >
        <label htmlFor="deck-name">New deck</label>
        <input id="deck-name" {...form.register('name')} className="border p-2" />
        {form.formState.errors.name && <p role="alert">{form.formState.errors.name.message}</p>}
        <button type="submit" disabled={createDeck.isPending}>
          Create
        </button>
      </form>

      <ul>
        {decks.data?.map((deck) => (
          <li key={deck.id}>
            {deck.name} — {deck._count.cards} cards
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Read it top to bottom: **query** (load), **mutation** (change), **form** (input), then the three states every data screen needs — loading, error, success.

### Accessibility basics we follow

- Every input has a `<label>`; errors use `role="alert"` so screen readers announce them.
- Everything works with the keyboard (study mode: Space to flip, 1–4 to rate).
- shadcn/ui components (built on Radix) handle focus and ARIA for dialogs and menus.
- Colour is never the only signal (e.g. "3 due" text, not just a red dot).

## Common mistakes

- Fetching in `useEffect` with `useState` by hand — you'll re-invent caching, race conditions and loading states. Use TanStack Query.
- Forgetting `key` in lists, or using the array index as the key for lists that change.
- Copying server data into `useState` and then wondering why it's stale.
- Treating front-end checks as security.
- One 600-line component — split by responsibility (list, item, form).

## Interview questions

**Q: What's the difference between props and state?**
A: Props are inputs passed from a parent and are read-only; state is data a component owns and changes over time, which triggers a re-render.

**Q: How do you fetch data in React?**
A: With TanStack Query: `useQuery` for reads, keyed by what's being fetched, and `useMutation` for writes, invalidating the related queries on success. It gives me caching, loading and error states, retries and polling.

**Q: How do you keep front-end and back-end validation in sync?**
A: Both import the same Zod schemas from a shared workspace package. React Hook Form uses them via `zodResolver`, Express uses them in a `validateBody` middleware.

**Q: Why an SPA and not Next.js?**
A: Everything is behind a login, so server rendering for SEO adds little, and one Express server serving a static build keeps hosting simple. For a public marketing site I'd use Next.js.

## Try it yourself

1. Add a "Delete deck" button using `useMutation` + `api.delete`, with a confirm dialog from shadcn/ui.
2. Add an empty state: when `decks.data` is empty, show "No decks yet — create your first one".
3. In DevTools → Network, watch the `decks` request refetch after you create a deck.
