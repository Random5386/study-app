// Second step of sign-in when two-factor is on: a 6-digit code or a recovery code.
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { mfaVerifySchema, type LoginResponse, type MfaVerifyInput } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { api, errorMessage, setCsrfToken } from '../../lib/api';
import { AuthLayout, linkClass } from './AuthLayout';
import { ME_KEY } from './useMe';

export function MfaVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [useRecovery, setUseRecovery] = useState(false);
  const form = useForm<MfaVerifyInput>({ resolver: zodResolver(mfaVerifySchema) });

  const verify = useMutation({
    mutationFn: (values: MfaVerifyInput) => api.post<LoginResponse>('/api/auth/mfa/verify', values),
    onSuccess: (res) => {
      setCsrfToken(res.csrfToken);
      queryClient.setQueryData(ME_KEY, res.user);
      navigate(from, { replace: true });
    },
    onError: () => form.resetField('code'),
  });

  return (
    <AuthLayout
      title="Two-factor sign-in"
      subtitle={
        useRecovery
          ? 'Enter one of the recovery codes you saved. Each one works once.'
          : 'Enter the 6-digit code from your authenticator app.'
      }
    >
      <form onSubmit={form.handleSubmit((values) => verify.mutate(values))} noValidate className="space-y-4">
        {verify.isError && <Alert tone="error">{errorMessage(verify.error)}</Alert>}
        <TextField
          key={useRecovery ? 'recovery' : 'totp'}
          label={useRecovery ? 'Recovery code' : 'Code'}
          autoComplete="one-time-code"
          inputMode={useRecovery ? 'text' : 'numeric'}
          placeholder={useRecovery ? 'a1b2c-3d4e5' : '123456'}
          autoFocus
          error={form.formState.errors.code?.message}
          {...form.register('code')}
        />
        <Button type="submit" loading={verify.isPending} className="w-full">
          Verify
        </Button>
        <button type="button" className={`${linkClass} text-sm`} onClick={() => setUseRecovery((v) => !v)}>
          {useRecovery ? 'Use my authenticator app instead' : 'Lost your phone? Use a recovery code'}
        </button>
      </form>
      <p className="mt-5 text-sm">
        <Link to="/login" className={linkClass}>
          Start again
        </Link>
      </p>
    </AuthLayout>
  );
}
