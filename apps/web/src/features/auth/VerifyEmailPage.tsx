// Opened from the link in the confirmation email: /verify-email?token=...
// The page sends the token to the API once, on purpose: a POST, not a GET, so email
// scanners that "pre-click" links can't use up the token.
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { api, errorMessage } from '../../lib/api';
import { AuthLayout, linkClass } from './AuthLayout';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = useMutation({ mutationFn: () => api.post('/api/auth/verify-email', { token }) });

  // React's StrictMode runs effects twice in development; the ref makes sure we only send once.
  const sent = useRef(false);
  useEffect(() => {
    if (token && !sent.current) {
      sent.current = true;
      verify.mutate();
    }
  }, [token, verify]);

  return (
    <AuthLayout title="Confirm your email">
      {!token && (
        <Alert tone="error">This link is missing its token. Open the link from your email again.</Alert>
      )}
      {verify.isPending && <p className="text-sm">Confirming…</p>}
      {verify.isSuccess && <Alert tone="success">Email confirmed. You can sign in now.</Alert>}
      {verify.isError && <Alert tone="error">{errorMessage(verify.error)}</Alert>}
      <p className="mt-5 text-sm">
        <Link to="/login" className={linkClass}>
          Go to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
