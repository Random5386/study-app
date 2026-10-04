// The subject filter on the left of the library: All, Not in a subject, then each subject.
import { useState, type FormEvent } from 'react';
import { SUBJECT_COLOURS, type SubjectColour } from '@studyapp/shared';
import { errorMessage } from '../../lib/api';
import { SUBJECT_DOT } from './format';
import { useCreateSubject, useDeleteSubject, useSubjects } from './useLibrary';

type Props = { selected?: string; onSelect: (subjectId?: string) => void };

export function SubjectList({ selected, onSelect }: Props) {
  const subjects = useSubjects();
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
    `flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
      active
        ? 'bg-indigo-100 font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
        : 'hover:bg-slate-100 dark:hover:bg-slate-900'
    }`;

  return (
    <nav aria-label="Subjects" className="space-y-1">
      <button type="button" className={item(!selected)} onClick={() => onSelect(undefined)}>
        All documents
      </button>
      <button type="button" className={item(selected === 'none')} onClick={() => onSelect('none')}>
        Not in a subject
      </button>

      <p className="px-2 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Subjects</p>
      {subjects.isError && <p className="px-2 text-xs text-red-600">{errorMessage(subjects.error)}</p>}
      {subjects.data?.map((s) => (
        <div key={s.id} className="group flex items-center">
          <button type="button" className={item(selected === s.id)} onClick={() => onSelect(s.id)}>
            <span className={`size-2.5 shrink-0 rounded-full ${SUBJECT_DOT[s.colour]}`} aria-hidden="true" />
            <span className="flex-1 truncate">{s.name}</span>
            <span className="text-xs text-slate-500">{s.documentCount}</span>
          </button>
          <button
            type="button"
            aria-label={`Delete subject ${s.name}`}
            title="Delete subject (its documents are kept)"
            className="invisible ml-1 rounded px-1 text-slate-400 group-hover:visible hover:text-red-600 focus:visible"
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
        <form onSubmit={submit} className="space-y-2 px-2 pt-2">
          <input
            autoFocus
            aria-label="Subject name"
            placeholder="e.g. Biology 101"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
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
                className={`size-5 rounded-full ${SUBJECT_DOT[c]} ${colour === c ? 'ring-2 ring-offset-1 ring-slate-500' : ''}`}
              />
            ))}
          </div>
          {create.isError && <p className="text-xs text-red-600">{errorMessage(create.error)}</p>}
          <div className="flex gap-2 text-sm">
            <button
              type="submit"
              className="font-medium text-indigo-600 dark:text-indigo-400"
              disabled={!name.trim()}
            >
              Add
            </button>
            <button type="button" className="text-slate-500" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="px-2 pt-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400"
          onClick={() => setAdding(true)}
        >
          + New subject
        </button>
      )}
    </nav>
  );
}
