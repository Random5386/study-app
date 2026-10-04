import { forwardRef, useId, type InputHTMLAttributes } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export const inputClass =
  'w-full rounded-xl border-2 bg-raised px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-muted/70 transition focus:border-focus focus:bg-surface focus:outline-none disabled:opacity-60';

/** A labelled input. Errors are announced to screen readers and linked with aria-describedby. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className = '', ...rest },
  ref,
) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${inputClass} ${error ? 'border-danger-600' : 'border-line'}`}
        {...rest}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs font-medium text-danger-600 dark:text-coral"
        >
          {error}
        </p>
      )}
    </div>
  );
});
