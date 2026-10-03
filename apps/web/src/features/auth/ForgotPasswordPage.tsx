import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { emailOnlySchema, type EmailOnlyInput } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { api, errorMessage } from '../../lib/api';
import { AuthLayout, linkClass } from './AuthLayout';

export function ForgotPasswordPage() {
  const form = useForm<EmailOnlyInput>({ resolver: zodResolver(emailOnlySchema) });
  const send = useMutation({
    mutationFn: (values: EmailOnlyInput) => api.post('/api/auth/forgot-password', values),
  });

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {send.isSuccess ? (
        <Alert tone="success">
          If an account uses that email, a reset link is on its way. It expires in 30 minutes.
        </Alert>
      ) : (
        <form onSubmit={form.handleSubmit((values) => send.mutate(values))} noValidate className="space-y-4">
          {send.isError && <Alert tone="error">{errorMessage(send.error)}</Alert>}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Button type="submit" loading={send.isPending} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-5 text-sm">
        <Link to="/login" className={linkClass}>
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
