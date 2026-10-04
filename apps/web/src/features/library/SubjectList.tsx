// The subject filter on the left of the library: All, Not in a subject, then each subject.
import { useState, type FormEvent } from 'react';
import { SUBJECT_COLOURS, type SubjectColour } from '@studyapp/shared';
import { Button } from '../../components/ui/Button';
import { useLevelWords } from '../../components/useLevelWords';
import { errorMessage } from '../../lib/api';
import { SUBJECT_DOT } from './format';
import { useCreateSubject, useDeleteSubject, useSubjects } from './useLibrary';

type Props = { selected?: string; onSelect: (subjectId?: string) => void };

export function SubjectList({ selected, onSelect }: Props) {
  const subjects = useSubjects();
  const words = useLevelWords(); // "subject" at school, "module" at university
  const create = useCreateSubject();
  const remove = useDeleteSubject();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [colour, setColour] = useState<SubjectColour>('indigo');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, colour },
      {
        onSuccess: (s) => {
          setName('');
          setAdding(false);
          onSelect(s.id);
        },
      },
    );
  };

  const item = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
      active ? 'bg-hover font-semibold text-ink' : 'text-muted hover:bg-hover hover:text-ink'
    }`;

  return (
    <nav aria-label={words.Subjects} className="space-y-1">
      <button type="button" className={item(!selected)} onClick={() => onSelect(undefined)}>
        <span aria-hidden>🗂️</span> All documents
      </button>
      <button type="button" className={item(selected === 'none')} onClick={() => onSelect('none')}>
        <span aria-hidden>📥</span> Not in a {words.subject}
      </button>

      <p className="px-2.5 pt-4 pb-1 text-xs font-bold tracking-wide text-muted uppercase">
        {words.Subjects}
      </p>
      {subjects.isError && <p className="px-2 text-xs text-danger-600">{errorMessage(subjects.error)}</p>}
      {subjects.data?.map((s) => (
        <div key={s.id} className="group flex items-center">
          <button type="button" className={item(selected === s.id)} onClick={() => onSelect(s.id)}>
            <span className={`size-3 shrink-0 rounded-[5px] ${SUBJECT_DOT[s.colour]}`} aria-hidden="true" />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="rounded-md bg-hover px-1.5 text-xs font-semibold text-muted">
              {s.documentCount}
            </span>
          </button>
          <button
            type="button"
            aria-label={`Delete ${words.subject} ${s.name}`}
            title={`Delete ${words.subject} (its documents are kept)`}
            className="invisible ml-1 rounded-md px-1.5 text-lg leading-none text-muted group-hover:visible hover:bg-hover hover:text-danger-600 focus:visible"
            onClick={() => {
              remove.mutate(s.id);
              if (selected === s.id) onSelect(undefined);
            }}
          >
            ×
          </button>
        </div>
      ))}

      {adding ? (
        <form onSubmit={submit} className="space-y-2.5 rounded-xl border-2 border-line bg-surface p-2.5">
          <input
            autoFocus
            aria-label={`${words.Subject} name`}
            placeholder={words.subject === 'module' ? 'e.g. BIO101: Cell Biology' : 'e.g. Life Sciences'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border-2 border-line bg-raised px-2.5 py-1.5 text-sm focus:border-focus focus:outline-none"
          />
          <div className="flex gap-1" role="radiogroup" aria-label="Colour">
            {SUBJECT_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={colour === c}
                aria-label={c}
                onClick={() => setColour(c)}
                className={`size-5 rounded-full ${SUBJECT_DOT[c]} ${colour === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}
              />
            ))}
          </div>
          {create.isError && <p className="text-xs text-danger-600">{errorMessage(create.error)}</p>}
          <div className="flex gap-2 text-sm">
            <Button type="submit" size="sm" disabled={!name.trim()}>
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-muted hover:bg-hover hover:text-ink"
          onClick={() => setAdding(true)}
        >
          + New {words.subject}
        </button>
      )}
    </nav>
  );
}
