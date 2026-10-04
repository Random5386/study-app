import type { ReactNode } from 'react';

type Tone = 'neutral' | 'green' | 'blue' | 'orange' | 'red' | 'purple';

const TONES: Record<Tone, string> = {
  neutral: 'bg-hover text-muted',
  green: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  blue: 'bg-[#ddf4ff] text-[#0b5f8a] dark:bg-[#0f2a3a] dark:text-[#a5dcfb]',
  orange: 'bg-[#fff0d9] text-[#8a4b00] dark:bg-[#3a2a10] dark:text-[#ffd59a]',
  red: 'bg-[#ffe5e5] text-[#9b1c1c] dark:bg-[#3a1d1d] dark:text-[#ffb4b4]',
  purple: 'bg-[#f5e8ff] text-[#6b21a8] dark:bg-[#2e1a3d] dark:text-[#e2c2ff]',
};

/** A small rounded label: statuses, counts, "New". */
export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
