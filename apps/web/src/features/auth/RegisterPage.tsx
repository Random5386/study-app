// Create an account. The server always answers "check your inbox", even for an
// email that's already registered, so nobody can find out who has an account.
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { Link } from 'react-router';
import { PASSWORD_MIN, registerSchema, type RegisterInput } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { StudyLevelPicker } from '../../components/StudyLevelPicker';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { api, errorMessage } from '../../lib/api';
import { AuthLayout, linkClass } from './AuthLayout';

export function RegisterPage() {
  // The form holds the *input* shape; zodResolver hands handleSubmit the cleaned *output* shape.
  const form = useForm<z.input<typeof registerSchema>, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { schoolGrade: null },
  });
  const schoolGrade = useWatch({ control: form.control, name: 'schoolGrade' });
  const register = useMutation({
    mutationFn: (values: RegisterInput) => api.post('/api/auth/register', values),
  });

  if (register.isSuccess) {
    return (
      <AuthLayout title="Check your inbox">
        <p className="text-sm">
          We sent a confirmation link to <strong>{form.getValues('email')}</strong>. Click it to finish
          creating your account.
        </p>
        <p className="mt-3 text-sm text-muted">
          Running locally? Emails appear in Mailpit at{' '}
          <a href="http://localhost:8025" target="_blank" rel="noreferrer" className={linkClass}>
            localhost:8025
          </a>
          .
        </p>
        <p className="mt-5 text-sm">
          <Link to="/login" className={linkClass}>
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link to="/login" className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit((values) => register.mutate(values))}
        noValidate
        className="space-y-4"
      >
        {register.isError && <Alert tone="error">{errorMessage(register.error)}</Alert>}
        <TextField
          label="Your name"
          autoComplete="name"
          error={form.formState.errors.displayName?.message}
          {...form.register('displayName')}
        />
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
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters. A few random words works well.`}
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Controller
          control={form.control}
          name="studyLevel"
          render={({ field, fieldState }) => (
            <StudyLevelPicker
              compact
              value={{
                studyLevel: field.value ?? null,
                schoolGrade: (schoolGrade as number | null | undefined) ?? null,
              }}
              onChange={(v) => {
                field.onChange(v.studyLevel);
                form.setValue('schoolGrade', v.schoolGrade);
              }}
              error={fieldState.error?.message}
            />
          )}
        />
        <p className="text-xs text-muted">
          We use this to pitch AI summaries at your level. You can change it later.
        </p>
        <Button type="submit" loading={register.isPending} size="lg" fullWidth>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
