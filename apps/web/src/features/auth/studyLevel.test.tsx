// Choosing a study level: at sign-up, and on Home for older accounts that don't have one yet.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { signedInFakes, testUser } from '../../test/fixtures';
import { mockApi, renderApp } from '../../test/renderApp';

const signedOut = { status: 200, body: { user: null, mfaPending: false } };

describe('sign-up', () => {
  it('needs a study level, and asks for a grade only for high school', async () => {
    const calls = mockApi({
      'GET /api/auth/session': signedOut,
      'GET /api/auth/csrf': { status: 200, body: { csrfToken: 't' } },
      'POST /api/auth/register': { status: 202, body: { message: 'Check your inbox' } },
    });
    renderApp('/register');

    await userEvent.type(await screen.findByLabelText('Your name'), 'Thandi');
    await userEvent.type(screen.getByLabelText('Email'), 'thandi@test.dev');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery staple');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Choose your study level')).toBeInTheDocument();

    expect(screen.queryByRole('radio', { name: 'Grade 10' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /High school/ }));
    await userEvent.click(screen.getByRole('radio', { name: 'Grade 10' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/auth/register')?.body).toMatchObject({
      displayName: 'Thandi',
      studyLevel: 'HIGH_SCHOOL',
      schoolGrade: 10,
    });
  });
});

describe('home page', () => {
  it('asks older accounts for their level, then shows it as a badge', async () => {
    let user = { ...testUser, studyLevel: null, schoolGrade: null };
    const calls = mockApi({
      ...signedInFakes(),
      'GET /api/auth/session': () => ({ status: 200, body: { user, mfaPending: false } }),
      'PATCH /api/account/profile': (body) => {
        user = { ...user, ...(body as object) };
        return { status: 200, body: user };
      },
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'One quick question' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /College or TVET/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save my level' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'One quick question' })).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/College or TVET/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      studyLevel: 'COLLEGE',
      schoolGrade: null,
    });
  });

  it('uses "modules" for university students', async () => {
    mockApi(signedInFakes({ ...testUser, studyLevel: 'UNIVERSITY' }));
    renderApp('/');
    expect(await screen.findByText('modules')).toBeInTheDocument();
  });
});
