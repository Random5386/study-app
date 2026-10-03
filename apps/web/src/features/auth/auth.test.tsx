// What the user sees during sign-in, with the API faked. See docs/15-testing.md.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderApp } from '../../test/renderApp';

const user = {
  id: '0192f3a0-0000-7000-8000-000000000001',
  email: 'ada@test.dev',
  displayName: 'Ada',
  emailVerified: true,
  mfaEnabled: true,
  createdAt: new Date().toISOString(),
};
const signedOut = { status: 200, body: { user: null, mfaPending: false } };
const health = { ok: true, app: 'StudyApp', database: 'up', time: new Date().toISOString() };

describe('protected pages', () => {
  it('sends signed-out visitors to the sign-in page', async () => {
    mockApi({ 'GET /api/auth/session': signedOut });
    const { router } = renderApp('/settings/security');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('sign-in form', () => {
  it('checks the form before calling the API', async () => {
    const calls = mockApi({ 'GET /api/auth/session': signedOut });
    renderApp('/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/api/auth/login')).toBe(false);
  });

  it('signs in with password + MFA code and sends the CSRF token', async () => {
    let signedIn = false;
    const calls = mockApi({
      'GET /api/auth/session': () =>
        signedIn ? { status: 200, body: { user, mfaPending: false } } : signedOut,
      'GET /api/auth/csrf': { status: 200, body: { csrfToken: 'token-before-login' } },
      'POST /api/auth/login': { status: 200, body: { mfaRequired: true, csrfToken: 'token-after-password' } },
      'POST /api/auth/mfa/verify': () => {
        signedIn = true;
        return { status: 200, body: { mfaRequired: false, csrfToken: 'token-after-mfa', user } };
      },
      'GET /api/health': { status: 200, body: health },
    });
    const { router } = renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@test.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await userEvent.type(await screen.findByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('heading', { name: 'Welcome, Ada' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');

    const login = calls.find((c) => c.path === '/api/auth/login');
    expect(login?.headers.get('X-CSRF-Token')).toBe('token-before-login');
    const mfa = calls.find((c) => c.path === '/api/auth/mfa/verify');
    expect(mfa?.headers.get('X-CSRF-Token')).toBe('token-after-password'); // swapped after login
  });

  it('offers to resend the confirmation email when the address is not verified', async () => {
    mockApi({
      'GET /api/auth/session': signedOut,
      'GET /api/auth/csrf': { status: 200, body: { csrfToken: 't' } },
      'POST /api/auth/login': {
        status: 403,
        body: {
          error: 'Please confirm your email address first.',
          details: { reason: 'EMAIL_NOT_VERIFIED' },
        },
      },
      'POST /api/auth/resend-verification': { status: 202, body: {} },
    });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Email'), 'ada@test.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'whatever password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Send the link again' }));
    await waitFor(() =>
      expect(screen.getByText('A new confirmation link is on its way.')).toBeInTheDocument(),
    );
  });
});
