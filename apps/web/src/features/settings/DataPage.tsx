// Settings → Your data. South Africa's POPIA (like Europe's GDPR) gives people the right to
// get a copy of their personal information and to have it deleted. Both need your password.
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import {
  deleteAccountSchema,
  passwordConfirmSchema,
  type DeleteAccountInput,
  type PasswordConfirmInput,
} from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, IconTile } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { api, errorMessage, setCsrfToken } from '../../lib/api';
import { useMe } from '../auth/useMe';

function saveJson(data: unknown, fileName: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  link.click();
  URL.revokeObjectURL(url);
}

function ExportCard() {
  const form = useForm<PasswordConfirmInput>({ resolver: zodResolver(passwordConfirmSchema) });
  const exportData = useMutation({
    mutationFn: (values: PasswordConfirmInput) => api.post<unknown>('/api/account/export', values),
    onSuccess: (data) => {
      saveJson(data, `studyapp-export-${new Date().toISOString().slice(0, 10)}.json`);
      form.reset();
    },
  });

  return (
    <Card
      icon={<IconTile className="bg-[#ddf4ff] dark:bg-[#0f2a3a]">📦</IconTile>}
      title="Download your data"
      description="A JSON file with your profile, subjects, study guide details, progress and security history. Passwords and secrets are never included."
    >
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => exportData.mutate(v))}>
        {exportData.isError && <Alert tone="error">{errorMessage(exportData.error)}</Alert>}
        {exportData.isSuccess && <Alert tone="success">Your download has started.</Alert>}
        <TextField
          label="Confirm your password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        <Button type="submit" variant="secondary" loading={exportData.isPending}>
          Download my data
        </Button>
      </form>
    </Card>
  );
}

function DeleteAccountCard() {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<DeleteAccountInput>({ resolver: zodResolver(deleteAccountSchema) });
  const remove = useMutation({
    mutationFn: (values: DeleteAccountInput) => api.delete('/api/account', values),
    onSuccess: () => {
      setCsrfToken(null);
      queryClient.clear();
      navigate('/login', { replace: true, state: { accountDeleted: true } });
    },
  });

  return (
    <Card
      tone="danger"
      icon={<IconTile className="bg-[#ffe5e5] dark:bg-[#3a1d1d]">🗑️</IconTile>}
      title="Delete account"
      description="Permanently deletes your account, study guides, progress and history. This can't be undone, so download your data first if you want a copy."
    >
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => remove.mutate(v))}>
        {remove.isError && <Alert tone="error">{errorMessage(remove.error)}</Alert>}
        <TextField
          label="Your password"
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {me?.mfaEnabled && (
          <TextField
            label="Authenticator code"
            inputMode="numeric"
            autoComplete="one-time-code"
            hint="Or one of your recovery codes."
            error={form.formState.errors.code?.message}
            {...form.register('code', { setValueAs: (v: string) => v || undefined })}
          />
        )}
        <TextField
          label="Type DELETE to confirm"
          autoComplete="off"
          spellCheck={false}
          error={form.formState.errors.confirm?.message}
          {...form.register('confirm')}
        />
        <Button type="submit" variant="danger" loading={remove.isPending}>
          Delete my account forever
        </Button>
      </form>
    </Card>
  );
}

export function DataPage() {
  return (
    <>
      <h2 className="sr-only">Your data</h2>
      <ExportCard />
      <DeleteAccountCard />
    </>
  );
}
