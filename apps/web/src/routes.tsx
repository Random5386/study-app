// Which page shows for which URL.
// The library and settings pages load on demand (`lazy`), so the first page view downloads less
// JavaScript. Vite splits each import() into its own file. See docs/18-design-system.md.
// Public pages (sign in, register, ...) sit outside <RequireAuth>; everything else is inside it.
import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ComingSoon } from './components/ComingSoon';
import { NotFoundPage } from './components/NotFoundPage';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { LoginPage } from './features/auth/LoginPage';
import { MfaVerifyPage } from './features/auth/MfaVerifyPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { PublicOnly, RequireAuth } from './features/auth/RequireAuth';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { VerifyEmailPage } from './features/auth/VerifyEmailPage';
import { HomePage } from './features/home/HomePage';

/** Loads a page component from its own file the first time its URL is visited. */
const page = <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) => ({
  lazy: async () => ({ Component: (await load())[name] as React.ComponentType }),
});

export const routes = [
  {
    element: <PublicOnly />, // signed-in users are sent to the dashboard
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  // These work whether or not you're signed in (they're opened from emails).
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/mfa', element: <MfaVerifyPage /> },
  {
    element: <RequireAuth />, // everything below needs a signed-in user
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'documents', ...page(() => import('./features/library/LibraryPage'), 'LibraryPage') },
          {
            path: 'documents/:id',
            ...page(() => import('./features/library/DocumentPage'), 'DocumentPage'),
          },
          {
            path: 'notes',
            element: (
              <ComingSoon
                emoji="📝"
                title="Notes"
                phase={6}
                teaser="Notion-style pages for your own notes, with headings, lists and checklists."
              />
            ),
          },
          {
            path: 'decks',
            element: (
              <ComingSoon
                emoji="🃏"
                title="Flashcards"
                phase={5}
                teaser="Make decks by hand, or let AI draft cards from a study guide."
              />
            ),
          },
          {
            path: 'study',
            element: (
              <ComingSoon
                emoji="🎯"
                title="Study"
                phase={5}
                teaser="Short review sessions with spaced repetition, so cards come back just before you forget them."
              />
            ),
          },
          {
            path: 'settings', // opened from the profile menu
            ...page(() => import('./features/settings/SettingsLayout'), 'SettingsLayout'),
            children: [
              { index: true, element: <Navigate to="profile" replace /> },
              { path: 'profile', ...page(() => import('./features/settings/ProfilePage'), 'ProfilePage') },
              {
                path: 'appearance',
                ...page(() => import('./features/settings/AppearancePage'), 'AppearancePage'),
              },
              { path: 'security', ...page(() => import('./features/settings/SecurityPage'), 'SecurityPage') },
              { path: 'data', ...page(() => import('./features/settings/DataPage'), 'DataPage') },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
