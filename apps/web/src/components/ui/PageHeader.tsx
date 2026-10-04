// The top of every page, Notion style: a big emoji, a bold title and a short description.
import type { ReactNode } from 'react';

type PageHeaderProps = {
  emoji: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ emoji, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <span aria-hidden className="mb-3 block text-5xl leading-none">
          {emoji}
        </span>
        <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
