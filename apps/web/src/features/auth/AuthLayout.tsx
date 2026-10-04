// The frame for every sign-in / sign-up page: a bright, friendly brand panel on the left
// (desktop only) and a calm form on the right.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Wordmark } from '../../components/Logo';

const FEATURES = [
  { emoji: '📄', title: 'Summaries in seconds', text: 'Upload a study guide and get the key points.' },
  { emoji: '🃏', title: 'Flashcards that stick', text: 'Make your own, or let AI draft them for you.' },
  { emoji: '🔥', title: 'Get on a roll', text: 'Build a streak of right answers in every review.' },
];

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-brand-500 p-12 text-brand-900 lg:flex lg:flex-col lg:justify-between">
      {/* soft decorative circles */}
      <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-white/15" />
      <div aria-hidden className="absolute -bottom-32 -left-16 size-96 rounded-full bg-[#46a302]/40" />

      <div className="relative">
        <p className="font-display text-sm font-black tracking-widest text-brand-900/70 uppercase">
          StudyApp
        </p>
        <h2 className="mt-4 max-w-md text-5xl leading-[1.05] font-black">
          Study smarter, a little every day.
        </h2>
      </div>

      <ul className="relative space-y-3">
        {FEATURES.map((f, i) => (
          <li
            key={f.title}
            className="flex max-w-sm items-center gap-4 rounded-2xl border-2 border-b-[6px] border-[#46a302] bg-white p-4 text-ink shadow-sm"
            style={{ marginLeft: `${i * 1.5}rem` }}
          >
            <span aria-hidden className="text-3xl">
              {f.emoji}
            </span>
            <span>
              <span className="block font-display font-extrabold">{f.title}</span>
              <span className="block text-sm text-[#55534e]">{f.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="relative text-sm font-semibold text-brand-900/70">
        Built with React, Express and PostgreSQL.
      </p>
    </aside>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-canvas text-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <BrandPanel />
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/login" className="self-start rounded-lg">
          <Wordmark />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl font-black">{title}</h1>
            {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export const linkClass = 'font-semibold text-link hover:underline';
