// Email + password. If two-factor sign-in is on, the next stop is /mfa.
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { loginSchema, type LoginInput, type LoginResponse } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { api, ApiError, errorMessage, setCsrfToken } from '../../lib/api';
import { AuthLayout, linkClass } from './AuthLayout';
import { ME_KEY } from './useMe';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [resent, setResent] = useState(false);
  const accountDeleted = Boolean((location.state as { accountDeleted?: boolean } | null)?.accountDeleted);

  // The same Zod schema the API uses, so the rules can't drift apart.
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const login = useMutation({
    mutationFn: (values: LoginInput) => api.post<LoginResponse>('/api/auth/login', values),
    onSuccess: (res) => {
      setCsrfToken(res.csrfToken); // new session → new CSRF token
      if (res.mfaRequired) {
        navigate('/mfa', { state: { from } });
      } else {
        queryClient.setQueryData(ME_KEY, res.user);
        navigate(from, { replace: true });
      }
    },
  });

  const resend = useMutation({
    mutationFn: () => api.post('/api/auth/resend-verification', { email: form.getValues('email') }),
    onSuccess: () => setResent(true),
  });

  const notVerified =
    login.error instanceof ApiError &&
    (login.error.details as { reason?: string } | undefined)?.reason === 'EMAIL_NOT_VERIFIED';

  return (
    <AuthLayout
      title="Sign in"
      subtitle={
        <>
          Welcome back! New here?{' '}
          <Link to="/register" className={linkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit((values) => login.mutate(values))} noValidate className="space-y-4">
        {login.isError && (
          <Alert tone="error">
            {errorMessage(login.error)}
            {notVerified && !resent && (
              <>
                {' '}
                <button type="button" className="underline" onClick={() => resend.mutate()}>
                  Send the link again
                </button>
              </>
            )}
          </Alert>
        )}
        {resent && <Alert tone="success">A new confirmation link is on its way.</Alert>}
        {accountDeleted && !login.isError && (
          <Alert tone="success">Your account has been deleted. Thanks for studying with us. 👋</Alert>
        )}

        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" loading={login.isPending} size="lg" fullWidth>
          Sign in
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className={linkClass}>
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
