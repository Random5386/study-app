// Drag files here, or click to choose. Files upload one at a time, each with its own status line.
import { useRef, useState, type DragEvent } from 'react';
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from '@studyapp/shared';
import { Button } from '../../components/ui/Button';
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
        className={`rounded-2xl border-2 border-dashed px-6 py-7 text-center transition-colors ${
          dragging ? 'border-sky bg-[#ebf8ff] dark:bg-[#0f2a3a]' : 'border-line-strong bg-raised'
        }`}
      >
        <p aria-hidden className={`text-4xl transition-transform ${dragging ? 'scale-125' : ''}`}>
          📤
        </p>
        <p className="mt-2 font-display text-lg font-black">Drop study guides here</p>
        <p className="mt-1 text-sm text-muted">
          PDF, Word (.docx), text or Markdown · up to {formatBytes(MAX_UPLOAD_BYTES)} each
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
          Choose files
        </Button>
        <p className="mx-auto mt-4 max-w-lg text-xs text-muted">
          AI features send document text to Google Gemini&apos;s free tier, which may use it to improve its
          products. Don&apos;t upload personal or confidential material.
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
        <ul className="mt-3 space-y-1.5 text-sm" aria-live="polite">
          {items.map((it, i) => (
            <li
              key={`${it.name}-${i}`}
              className="flex items-center justify-between gap-4 rounded-xl border-2 border-line bg-surface px-3 py-2"
            >
              <span className="truncate">{it.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={
                    it.state === 'error'
                      ? 'font-semibold text-danger-600 dark:text-coral'
                      : it.state === 'uploading'
                        ? 'text-muted'
                        : 'font-semibold text-brand-600 dark:text-brand-400'
                  }
                >
                  {it.state === 'uploading' ? 'Uploading…' : it.state === 'done' ? 'Uploaded' : it.message}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
