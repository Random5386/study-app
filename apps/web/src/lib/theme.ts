// Light, dark or "match my device". The choice is a per-browser convenience, so it lives in
// localStorage (not the database). public/theme.js applies it before React starts.
import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'studyapp.theme';
const listeners = new Set<() => void>();
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function getTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system'; // storage can be blocked (private mode, strict settings)
  }
}

function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && Boolean(darkQuery()?.matches));
  document.documentElement.classList.toggle('dark', dark);
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // still apply it for this visit
  }
  apply(choice);
  listeners.forEach((notify) => notify());
}

// When the device switches between light and dark, follow it if the choice is "system".
darkQuery()?.addEventListener('change', () => apply(getTheme()));

/** The current choice, re-rendering when it changes. */
export function useTheme(): ThemeChoice {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    getTheme,
    () => 'system',
  );
}
