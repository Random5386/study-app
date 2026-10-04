import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

type Tone = 'error' | 'success' | 'info' | 'warning';

const TONES: Record<Tone, { box: string; Icon: typeof Info }> = {
  error: {
    box: 'border-danger-600/30 bg-[#fff0f0] text-[#9b1c1c] dark:bg-[#3a1d1d] dark:text-[#ffb4b4]',
    Icon: CircleAlert,
  },
  success: {
    box: 'border-brand-500/40 bg-brand-50 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200',
    Icon: CircleCheck,
  },
  info: {
    box: 'border-sky/40 bg-[#ebf8ff] text-[#0b5f8a] dark:bg-[#0f2a3a] dark:text-[#a5dcfb]',
    Icon: Info,
  },
  warning: {
    box: 'border-fire/40 bg-[#fff6e5] text-[#8a4b00] dark:bg-[#3a2a10] dark:text-[#ffd59a]',
    Icon: TriangleAlert,
  },
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm ${box}`}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
