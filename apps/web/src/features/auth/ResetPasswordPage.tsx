// Opened from the reset email: /reset-password?token=...
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { passwordSchema, PASSWORD_MIN } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { api, errorMessage } from '../../lib/api';
import { AuthLayout, linkClass } from './AuthLayout';

// Front-end-only extra: type the new password twice.
const formSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match", path: ['confirm'] });
type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });
  const reset = useMutation({
    mutationFn: (values: FormValues) =>
      api.post('/api/auth/reset-password', { token, password: values.password }),
  });

  return (
    <AuthLayout title="Choose a new password">
      {reset.isSuccess ? (
        <Alert tone="success">Password changed and all your devices were signed out. Sign in again.</Alert>
      ) : (
        <form onSubmit={form.handleSubmit((values) => reset.mutate(values))} noValidate className="space-y-4">
          {!token && (
            <Alert tone="error">This link is missing its token. Open the link from your email again.</Alert>
          )}
          {reset.isError && <Alert tone="error">{errorMessage(reset.error)}</Alert>}
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN} characters.`}
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <TextField
            label="Type it again"
            type="password"
            autoComplete="new-password"
            error={form.formState.errors.confirm?.message}
            {...form.register('confirm')}
          />
          <Button type="submit" loading={reset.isPending} disabled={!token} className="w-full">
            Change password
          </Button>
        </form>
      )}
      <p className="mt-5 text-sm">
        <Link to="/login" className={linkClass}>
          Go to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
