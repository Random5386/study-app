// Which page shows for which URL.
// Public pages (sign in, register, ...) sit outside <RequireAuth>; everything else is inside it.
import { createBrowserRouter } from 'react-router';
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
import { DocumentPage } from './features/library/DocumentPage';
import { LibraryPage } from './features/library/LibraryPage';
import { SecurityPage } from './features/settings/SecurityPage';

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
          { path: 'documents', element: <LibraryPage /> },
          { path: 'documents/:id', element: <DocumentPage /> },
          { path: 'notes', element: <ComingSoon title="Notes" phase={6} /> },
          { path: 'decks', element: <ComingSoon title="Flashcards" phase={5} /> },
          { path: 'study', element: <ComingSoon title="Study session" phase={5} /> },
          { path: 'settings/security', element: <SecurityPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
