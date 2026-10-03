// Every request to our API goes through here, so the CSRF header and error handling
// are written once. See docs/13-react-frontend.md and docs/08-web-security.md.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---- CSRF token ----
// The server keeps a secret token in our session; we must send it back as a header
// on every change (POST/PATCH/DELETE). Another website can't read it, so it can't forge requests.
let csrfToken: string | null = null;

/** Use the fresh token the server returns after sign-in (a new session gets a new token). */
export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};

async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const res = await fetch('/api/auth/csrf', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new ApiError(res.status, 'Could not reach the server');
    csrfToken = ((await res.json()) as { csrfToken: string }).csrfToken;
  }
  return csrfToken;
}

async function request<T>(method: string, url: string, body?: unknown, isRetry = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (method !== 'GET') headers['X-CSRF-Token'] = await getCsrfToken();

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // file uploads: the browser sets the multipart Content-Type itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const { error, details } = (data ?? {}) as { error?: string; details?: unknown };
    // Our session may have expired (taking its CSRF token with it): get a new token and retry once.
    if (res.status === 403 && error?.includes('CSRF') && !isRetry) {
      csrfToken = null;
      return request<T>(method, url, body, true);
    }
    throw new ApiError(res.status, error ?? 'Something went wrong', details);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  delete: (url: string) => request<void>('DELETE', url),
};

/** A friendly message for any error thrown by `api`. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Could not reach the server. Is `npm run dev` running?';
}
