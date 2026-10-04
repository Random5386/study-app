// The profile button at the bottom of the sidebar. Opens a menu with your settings,
// the theme switch and "Sign out". Radix gives us an accessible menu: arrow keys, Escape,
// focus handling and screen-reader roles all work without extra code.
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ChevronsUpDown, Database, LogOut, Monitor, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useLogout } from '../features/auth/useLogout';
import { useMe } from '../features/auth/useMe';
import { setTheme, useTheme, type ThemeChoice } from '../lib/theme';
import { Avatar } from './ui/Avatar';

const itemClass =
  'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-hover';

const THEMES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ProfileMenu() {
  const { data: me } = useMe();
  const theme = useTheme();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!me) return null;

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Profile and settings"
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-hover data-[state=open]:bg-hover"
      >
        <Avatar name={me.displayName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{me.displayName}</span>
          <span className="block truncate text-xs text-muted">{me.email}</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="animate-pop-in z-50 w-[var(--radix-dropdown-menu-trigger-width)] min-w-64 rounded-2xl border-2 border-line bg-surface p-1.5 text-ink shadow-xl shadow-black/10"
        >
          <div className="flex items-center gap-3 px-2.5 py-2">
            <Avatar name={me.displayName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{me.displayName}</p>
              <p className="truncate text-xs text-muted">{me.email}</p>
            </div>
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />

          <Menu.Item className={itemClass} onSelect={() => navigate('/settings/profile')}>
            <UserRound aria-hidden className="size-4 text-muted" /> Profile
          </Menu.Item>
          <Menu.Item className={itemClass} onSelect={() => navigate('/settings/security')}>
            <ShieldCheck aria-hidden className="size-4 text-muted" /> Security
            {!me.mfaEnabled && (
              <span className="ml-auto rounded-full bg-fire px-1.5 text-[0.65rem] font-black text-white">
                !
              </span>
            )}
          </Menu.Item>
          <Menu.Item className={itemClass} onSelect={() => navigate('/settings/data')}>
            <Database aria-hidden className="size-4 text-muted" /> Your data
          </Menu.Item>

          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Label className="px-2.5 pt-1.5 pb-1 text-xs font-semibold text-muted">Theme</Menu.Label>
          <Menu.RadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as ThemeChoice)}
            className="grid grid-cols-3 gap-1 px-1 pb-1"
          >
            {THEMES.map(({ value, label, Icon }) => (
              <Menu.RadioItem
                key={value}
                value={value}
                onSelect={(e) => e.preventDefault()} // keep the menu open while trying themes
                className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-transparent py-1.5 text-xs outline-none data-[highlighted]:bg-hover data-[state=checked]:border-brand-500 data-[state=checked]:font-bold"
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>

          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item className={itemClass} disabled={logout.isPending} onSelect={() => logout.mutate()}>
            <LogOut aria-hidden className="size-4 text-muted" /> Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
