import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { changePasswordSchema, PASSWORD_MIN, type ChangePasswordInput } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { api, errorMessage } from '../../lib/api';

export function ChangePasswordCard() {
  const queryClient = useQueryClient();
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });
  const change = useMutation({
    mutationFn: (values: ChangePasswordInput) => api.post('/api/account/password', values),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['account'] }); // sessions + history changed
    },
  });

  return (
    <Card title="Password" description="Changing it signs out your other devices.">
      <form onSubmit={form.handleSubmit((values) => change.mutate(values))} noValidate className="space-y-4">
        {change.isError && <Alert tone="error">{errorMessage(change.error)}</Alert>}
        {change.isSuccess && (
          <Alert tone="success">Password changed. Your other devices were signed out.</Alert>
        )}
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.currentPassword?.message}
          {...form.register('currentPassword')}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters.`}
          error={form.formState.errors.newPassword?.message}
          {...form.register('newPassword')}
        />
        <Button type="submit" loading={change.isPending}>
          Change password
        </Button>
      </form>
    </Card>
  );
}
