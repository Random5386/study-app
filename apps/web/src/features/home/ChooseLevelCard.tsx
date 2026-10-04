// Shown on Home to accounts made before study levels existed (studyLevel is null).
// One question, then it disappears for good.
import { useState } from 'react';
import { StudyLevelPicker, type StudyLevelValue } from '../../components/StudyLevelPicker';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../lib/api';
import { useUpdateProfile } from '../settings/useProfile';

export function ChooseLevelCard() {
  const update = useUpdateProfile();
  const [value, setValue] = useState<StudyLevelValue>({ studyLevel: null, schoolGrade: null });

  return (
    <section
      aria-labelledby="choose-level"
      className="rounded-2xl border-2 border-sky/50 bg-[#ebf8ff] p-5 sm:p-6 dark:bg-[#0f2a3a]"
    >
      <h2 id="choose-level" className="text-xl font-extrabold">
        <span aria-hidden>🎯</span> One quick question
      </h2>
      <p className="mt-1 mb-4 text-muted">
        Tell us your study level so AI summaries are written at the right level for you. You can change it any
        time in Settings.
      </p>
      {update.isError && (
        <div className="mb-3">
          <Alert tone="error">{errorMessage(update.error)}</Alert>
        </div>
      )}
      <StudyLevelPicker value={value} onChange={setValue} />
      <Button
        className="mt-4"
        disabled={!value.studyLevel}
        loading={update.isPending}
        onClick={() =>
          value.studyLevel && update.mutate({ studyLevel: value.studyLevel, schoolGrade: value.schoolGrade })
        }
      >
        Save my level
      </Button>
    </section>
  );
}
