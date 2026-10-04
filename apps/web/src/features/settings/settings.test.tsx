// The profile menu and the settings pages, with the API faked.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { signedInFakes, testUser } from '../../test/fixtures';
import { mockApi, renderApp } from '../../test/renderApp';

describe('profile menu', () => {
  it('opens from the sidebar and leads to the security settings', async () => {
    mockApi({
      ...signedInFakes(),
      'GET /api/account/mfa': { status: 200, body: { enabled: true, recoveryCodesLeft: 10 } },
      'GET /api/account/sessions': { status: 200, body: [] },
      'GET /api/account/security-history': { status: 200, body: [] },
    });
    const { router } = renderApp('/');

    // Both the desktop sidebar and the phone menu exist in the DOM; use the first.
    await userEvent.click((await screen.findAllByRole('button', { name: 'Profile and settings' }))[0]!);
    await userEvent.click(await screen.findByRole('menuitem', { name: /Security/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/security'));
    expect(await screen.findByRole('heading', { name: 'Two-factor sign-in' })).toBeInTheDocument();
  });

  it('/settings opens the profile tab', async () => {
    mockApi(signedInFakes());
    const { router } = renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Your name' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/settings/profile');
  });
});

describe('profile and appearance', () => {
  it('saves a new display name', async () => {
    const calls = mockApi({
      ...signedInFakes(),
      'PATCH /api/account/profile': (body) => ({ status: 200, body: { ...testUser, ...(body as object) } }),
    });
    renderApp('/settings/profile');

    const name = await screen.findByLabelText('Display name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Ada Lovelace');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText('Saved. Nice to meet you!')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ displayName: 'Ada Lovelace' });
  });

  it('switches to dark mode', async () => {
    mockApi(signedInFakes());
    renderApp('/settings/appearance');

    await userEvent.click(await screen.findByRole('radio', { name: /Dark/ }));
    expect(document.documentElement).toHaveClass('dark');
    await userEvent.click(screen.getByRole('radio', { name: /Light/ }));
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

describe('deleting the account', () => {
  it('needs DELETE typed exactly, then signs out', async () => {
    let deleted = false;
    const calls = mockApi({
      ...signedInFakes(),
      'GET /api/auth/session': () => ({
        status: 200,
        body: { user: deleted ? null : testUser, mfaPending: false },
      }),
      'DELETE /api/account': () => {
        deleted = true;
        return { status: 200, body: { message: 'deleted' } };
      },
    });
    const { router } = renderApp('/settings/data');

    await userEvent.type(await screen.findByLabelText('Your password'), 'correct horse battery staple');
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account forever' }));
    expect(
      await screen.findByText('Type DELETE to confirm', { selector: '[role=alert]' }),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Type DELETE to confirm'));
    await userEvent.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await userEvent.click(screen.getByRole('button', { name: 'Delete my account forever' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({
      password: 'correct horse battery staple',
      confirm: 'DELETE',
    });
    expect(await screen.findByText(/Your account has been deleted/)).toBeInTheDocument();
  });
});
