// A rounded panel. `tone="danger"` is for destructive settings (delete account).
import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  tone?: 'default' | 'danger';
  className?: string;
  children?: ReactNode;
};

export function Card({
  title,
  description,
  icon,
  actions,
  tone = 'default',
  className = '',
  children,
}: CardProps) {
  const border = tone === 'danger' ? 'border-danger-600/40' : 'border-line';
  return (
    <section className={`rounded-2xl border-2 bg-surface p-5 sm:p-6 ${border} ${className}`}>
      {(title || description || actions) && (
        <header className="flex items-start gap-3">
          {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className={`text-lg font-extrabold ${tone === 'danger' ? 'text-danger-600' : ''}`}>
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children && <div className={title || description ? 'mt-5' : ''}>{children}</div>}
    </section>
  );
}

/** A small rounded square holding an icon or emoji, used beside card titles and stats. */
export function IconTile({
  children,
  className = 'bg-brand-100 text-brand-700',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span aria-hidden className={`grid size-10 place-items-center rounded-xl text-xl ${className}`}>
      {children}
    </span>
  );
}
