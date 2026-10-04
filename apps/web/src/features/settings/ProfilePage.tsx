// Settings → Profile: your name and account details.
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { describeLevel, displayNameSchema } from '@studyapp/shared';
import { useState } from 'react';
import { StudyLevelPicker, type StudyLevelValue } from '../../components/StudyLevelPicker';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { errorMessage } from '../../lib/api';
import { useMe } from '../auth/useMe';
import { useUpdateProfile } from './useProfile';

const nameForm = z.object({ displayName: displayNameSchema });
type NameForm = z.infer<typeof nameForm>;

export function ProfilePage() {
  const { data: me } = useMe();
  const update = useUpdateProfile();
  const form = useForm<NameForm>({
    resolver: zodResolver(nameForm),
    values: { displayName: me?.displayName ?? '' }, // refills the field when `me` changes
  });
  if (!me) return null;

  const memberSince = new Date(me.createdAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={me.displayName} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-display text-2xl font-black">{me.displayName}</p>
            <p className="truncate text-muted">{me.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="blue">Member since {memberSince}</Badge>
              {me.emailVerified && <Badge tone="green">Email confirmed</Badge>}
              {me.mfaEnabled ? (
                <Badge tone="green">Two-factor on</Badge>
              ) : (
                <Badge tone="orange">Two-factor off</Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Your name" description="Shown in the sidebar and in emails we send you.">
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            update.mutate(values, { onSuccess: () => form.reset(values) }),
          )}
        >
          {update.isError && <Alert tone="error">{errorMessage(update.error)}</Alert>}
          {update.isSuccess && !form.formState.isDirty && (
            <Alert tone="success">Saved. Nice to meet you!</Alert>
          )}
          <TextField
            label="Display name"
            autoComplete="name"
            error={form.formState.errors.displayName?.message}
            {...form.register('displayName')}
          />
          <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
            Save name
          </Button>
        </form>
      </Card>

      <StudyLevelCard />

      <Card
        title="Email address"
        description="Your email is how you sign in. Changing it is coming in a later version."
      >
        <p className="rounded-xl border-2 border-line bg-raised px-3.5 py-2.5 text-[0.95rem]">{me.email}</p>
      </Card>
    </>
  );
}

/** Study level: saved as soon as you pick, so there's no extra Save button to forget. */
function StudyLevelCard() {
  const { data: me } = useMe();
  const update = useUpdateProfile();
  // Local copy while saving, so the choice shows at once.
  const [draft, setDraft] = useState<StudyLevelValue | null>(null);
  if (!me) return null;
  const value = draft ?? { studyLevel: me.studyLevel, schoolGrade: me.schoolGrade };

  const change = (next: StudyLevelValue) => {
    if (!next.studyLevel) return;
    setDraft(next);
    update.mutate(
      { studyLevel: next.studyLevel, schoolGrade: next.schoolGrade },
      { onSettled: () => setDraft(null) },
    );
  };

  return (
    <Card
      title="Study level"
      description="AI summaries (and later, flashcards) are written to match. Summaries you made at another level are kept."
    >
      <div className="space-y-4">
        {update.isError && <Alert tone="error">{errorMessage(update.error)}</Alert>}
        <StudyLevelPicker value={value} onChange={change} />
        <p className="text-sm text-muted" role="status">
          {update.isPending ? 'Saving…' : `Current level: ${describeLevel(me.studyLevel, me.schoolGrade)}`}
        </p>
      </div>
    </Card>
  );
}
