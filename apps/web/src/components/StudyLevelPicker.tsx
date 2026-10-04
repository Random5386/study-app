// Choose your study level (and grade, for high school). Used at sign-up, in Settings → Profile,
// and on Home for accounts made before study levels existed. A "controlled" component: the
// parent owns the value and decides when to save.
import { SCHOOL_GRADES, STUDY_LEVEL_INFO, STUDY_LEVELS, type StudyLevel } from '@studyapp/shared';
import { useId } from 'react';

export type StudyLevelValue = { studyLevel: StudyLevel | null; schoolGrade: number | null };

type Props = {
  value: StudyLevelValue;
  onChange: (value: StudyLevelValue) => void;
  error?: string;
  compact?: boolean; // one column of smaller cards, for narrow forms
};

const cardClass = (checked: boolean) =>
  `flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-b-4 p-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${
    checked ? 'border-sky bg-[#ddf4ff] dark:bg-[#0f2a3a]' : 'border-line bg-surface hover:bg-raised'
  }`;

const gradeClass = (checked: boolean) =>
  `grid min-w-12 cursor-pointer place-items-center rounded-xl border-2 border-b-4 px-3 py-1.5 font-display font-extrabold transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${
    checked ? 'border-sky bg-[#ddf4ff] dark:bg-[#0f2a3a]' : 'border-line bg-surface hover:bg-raised'
  }`;

export function StudyLevelPicker({ value, onChange, error, compact }: Props) {
  const id = useId();
  return (
    <div className="space-y-4">
      <fieldset aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="mb-1.5 text-sm font-semibold">What are you studying?</legend>
        <div className={`grid gap-2 ${compact ? '' : 'sm:grid-cols-2'}`}>
          {STUDY_LEVELS.map((level) => {
            const info = STUDY_LEVEL_INFO[level];
            return (
              <label key={level} className={cardClass(value.studyLevel === level)}>
                <input
                  type="radio"
                  name={`${id}-level`}
                  value={level}
                  checked={value.studyLevel === level}
                  onChange={() =>
                    onChange({
                      studyLevel: level,
                      schoolGrade: level === 'HIGH_SCHOOL' ? value.schoolGrade : null,
                    })
                  }
                  className="sr-only"
                />
                <span aria-hidden className="text-2xl">
                  {info.emoji}
                </span>
                <span>
                  <span className="block font-display font-extrabold">{info.label}</span>
                  <span className="block text-xs text-muted">{info.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="mt-1.5 text-xs font-medium text-danger-600 dark:text-coral"
          >
            {error}
          </p>
        )}
      </fieldset>

      {value.studyLevel === 'HIGH_SCHOOL' && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">
            Grade <span className="font-normal text-muted">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {SCHOOL_GRADES.map((grade) => (
              <label key={grade} className={gradeClass(value.schoolGrade === grade)}>
                <input
                  type="radio"
                  name={`${id}-grade`}
                  value={grade}
                  checked={value.schoolGrade === grade}
                  onChange={() => onChange({ ...value, schoolGrade: grade })}
                  className="sr-only"
                  aria-label={`Grade ${grade}`}
                />
                {grade}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
