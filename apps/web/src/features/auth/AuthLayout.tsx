// The centred card used by every sign-in / sign-up page.
import type { ReactNode } from 'react';

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="w-full max-w-sm">
        <p className="mb-6 text-center text-xl font-bold text-indigo-600 dark:text-indigo-400">StudyApp</p>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-lg font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </main>
    </div>
  );
}

export const linkClass = 'font-medium text-indigo-600 hover:underline dark:text-indigo-400';
