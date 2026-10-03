import type { ReactNode } from 'react';

export function Card({
  title,
  description,
  children,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {title && <h2 className="font-semibold">{title}</h2>}
      {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>}
      <div className={title || description ? 'mt-4' : ''}>{children}</div>
    </section>
  );
}
