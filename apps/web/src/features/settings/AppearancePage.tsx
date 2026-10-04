// Settings → Appearance: light, dark, or match the device. Saved in this browser only.
import { Monitor, Moon, Sun } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { setTheme, useTheme, type ThemeChoice } from '../../lib/theme';

const THEMES: { value: ThemeChoice; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', hint: 'Bright and clean', Icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Easy on the eyes at night', Icon: Moon },
  { value: 'system', label: 'System', hint: 'Follow your device', Icon: Monitor },
];

/** A big tappable option card, used as a radio button. */
const optionClass = (checked: boolean) =>
  `flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-b-4 p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus ${
    checked ? 'border-sky bg-[#ddf4ff] dark:bg-[#0f2a3a]' : 'border-line bg-surface hover:bg-raised'
  }`;

export function AppearancePage() {
  const theme = useTheme();
  return (
    <Card title="Theme" description="Saved in this browser only, so your phone and laptop can differ.">
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map(({ value, label, hint, Icon }) => (
            <label key={value} className={optionClass(theme === value)}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-5 shrink-0" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Card>
  );
}
