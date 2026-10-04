// Drag files here, or click to choose. Files upload one at a time, each with its own status line.
import { useRef, useState, type DragEvent } from 'react';
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from '@studyapp/shared';
import { errorMessage } from '../../lib/api';
import { formatBytes } from './format';
import { useUploadDocument } from './useLibrary';

type Item = { name: string; state: 'uploading' | 'done' | 'duplicate' | 'error'; message?: string };

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

export function UploadDropzone({ subjectId }: { subjectId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<Item[]>([]);

  const setItem = (index: number, patch: Partial<Item>) =>
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const start = items.length;
    setItems((prev) => [...prev, ...list.map((f) => ({ name: f.name, state: 'uploading' as const }))]);

    for (const [i, file] of list.entries()) {
      // Check the size here too, so a big file fails instantly instead of after uploading.
      if (file.size > MAX_UPLOAD_BYTES) {
        setItem(start + i, { state: 'error', message: `Bigger than ${formatBytes(MAX_UPLOAD_BYTES)}` });
        continue;
      }
      try {
        const res = await upload.mutateAsync({ file, subjectId });
        setItem(
          start + i,
          res.duplicate ? { state: 'duplicate', message: 'Already in your library' } : { state: 'done' },
        );
      } catch (err) {
        setItem(start + i, { state: 'error', message: errorMessage(err) });
      }
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-6 text-center text-sm transition ${
          dragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
        }`}
      >
        <p>
          Drag study guides here, or{' '}
          <button
            type="button"
            className="font-medium text-indigo-600 underline dark:text-indigo-400"
            onClick={() => inputRef.current?.click()}
          >
            choose files
          </button>
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          PDF, Word (.docx), text or Markdown · up to {formatBytes(MAX_UPLOAD_BYTES)} each
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          AI features send document text to Google Gemini's free tier, which may use it to improve its
          products. Don't upload personal or confidential material.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          aria-label="Choose files to upload"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = ''; // allow choosing the same file again
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm" aria-live="polite">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="flex justify-between gap-4">
              <span className="truncate">{it.name}</span>
              <span
                className={
                  it.state === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : it.state === 'uploading'
                      ? 'text-slate-500'
                      : 'text-emerald-600 dark:text-emerald-400'
                }
              >
                {it.state === 'uploading' ? 'Uploading…' : it.state === 'done' ? 'Uploaded' : it.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
