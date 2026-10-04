// Turn two-factor sign-in on or off. Setup has three steps:
// 1) confirm your password  2) scan the QR code and type a code  3) save recovery codes.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { MfaSetupResponse, RecoveryCodesResponse } from '@studyapp/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { api, errorMessage } from '../../lib/api';
import { ME_KEY } from '../auth/useMe';
import { RecoveryCodes } from './RecoveryCodes';

type MfaStatus = { enabled: boolean; recoveryCodesLeft: number };
const MFA_KEY = ['account', 'mfa'];

export function MfaCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: MFA_KEY, queryFn: () => api.get<MfaStatus>('/api/account/mfa') });
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'codes' | 'disable'>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<MfaSetupResponse | null>(null);
  const [codes, setCodes] = useState<string[]>([]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['account'] });
    void queryClient.invalidateQueries({ queryKey: ME_KEY });
  };
  const resetForm = () => {
    setPassword('');
    setCode('');
  };

  const start = useMutation({
    mutationFn: () => api.post<MfaSetupResponse>('/api/account/mfa/setup', { password }),
    onSuccess: (res) => {
      setSetup(res);
      resetForm();
      setStep('scan');
    },
  });
  const confirm = useMutation({
    mutationFn: () => api.post<RecoveryCodesResponse>('/api/account/mfa/confirm', { code }),
    onSuccess: (res) => {
      setCodes(res.recoveryCodes);
      setSetup(null);
      resetForm();
      setStep('codes');
      refresh();
    },
  });
  const disable = useMutation({
    mutationFn: () => api.post('/api/account/mfa/disable', { password, code }),
    onSuccess: () => {
      resetForm();
      setStep('idle');
      refresh();
    },
  });
  const newCodes = useMutation({
    mutationFn: () => api.post<RecoveryCodesResponse>('/api/account/mfa/recovery-codes', { password }),
    onSuccess: (res) => {
      setCodes(res.recoveryCodes);
      resetForm();
      setStep('codes');
      refresh();
    },
  });

  const submit = (e: FormEvent, action: () => void) => {
    e.preventDefault();
    action();
  };

  if (status.isPending) return <Card title="Two-factor sign-in">Loading…</Card>;
  if (status.isError) return <Card title="Two-factor sign-in">{errorMessage(status.error)}</Card>;
  const enabled = status.data.enabled;

  return (
    <Card
      title="Two-factor sign-in"
      description="After your password, also ask for a code from an authenticator app (Google or Microsoft Authenticator)."
    >
      {step === 'codes' && <RecoveryCodes codes={codes} onDone={() => setStep('idle')} />}

      {step === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm">
            Status:{' '}
            <strong className={enabled ? 'text-brand-600 dark:text-brand-400' : ''}>
              {enabled ? 'On' : 'Off'}
            </strong>
            {enabled && ` · ${status.data.recoveryCodesLeft} recovery codes left`}
          </p>
          {enabled && status.data.recoveryCodesLeft <= 3 && (
            <Alert tone="warning">You're running low on recovery codes. Make new ones.</Alert>
          )}
          <div className="flex flex-wrap gap-2">
            {enabled ? (
              <>
                <Button variant="secondary" onClick={() => setStep('password')}>
                  Make new recovery codes
                </Button>
                <Button variant="danger" onClick={() => setStep('disable')}>
                  Turn off
                </Button>
              </>
            ) : (
              <Button onClick={() => setStep('password')}>Turn on</Button>
            )}
          </div>
        </div>
      )}

      {step === 'password' && (
        <form className="space-y-4" onSubmit={(e) => submit(e, () => (enabled ? newCodes : start).mutate())}>
          {(start.isError || newCodes.isError) && (
            <Alert tone="error">{errorMessage(start.error ?? newCodes.error)}</Alert>
          )}
          <TextField
            label="Confirm your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={start.isPending || newCodes.isPending}>
              Continue
            </Button>
            <Button variant="ghost" onClick={() => setStep('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === 'scan' && setup && (
        <form className="space-y-4" onSubmit={(e) => submit(e, () => confirm.mutate())}>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan this QR code, or type the key below.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          <img
            src={setup.qrCodeDataUrl}
            alt="QR code for your authenticator app"
            className="size-44 rounded-xl border-2 border-line bg-white p-2"
          />
          <p className="text-xs text-muted">
            Key: <code className="font-mono break-all">{setup.manualKey}</code>
          </p>
          {confirm.isError && <Alert tone="error">{errorMessage(confirm.error)}</Alert>}
          <TextField
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={confirm.isPending}>
              Turn on
            </Button>
            <Button variant="ghost" onClick={() => setStep('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === 'disable' && (
        <form className="space-y-4" onSubmit={(e) => submit(e, () => disable.mutate())}>
          <Alert tone="warning">Your account will be protected by your password only.</Alert>
          {disable.isError && <Alert tone="error">{errorMessage(disable.error)}</Alert>}
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            label="Code from your app (or a recovery code)"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={disable.isPending}>
              Turn off
            </Button>
            <Button variant="ghost" onClick={() => setStep('idle')}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
