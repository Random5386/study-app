// Settings, opened from the profile menu. Tabs down the left (like Notion's settings),
// across the top on phones. Each tab is its own URL, so you can link to /settings/security.
import { Database, Palette, ShieldCheck, UserRound } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { PageHeader } from '../../components/ui/PageHeader';

const TABS = [
  { to: 'profile', label: 'Profile', Icon: UserRound },
  { to: 'appearance', label: 'Appearance', Icon: Palette },
  { to: 'security', label: 'Security', Icon: ShieldCheck },
  { to: 'data', label: 'Your data', Icon: Database },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
    isActive ? 'bg-hover font-semibold text-ink' : 'text-muted hover:bg-hover hover:text-ink'
  }`;

export function SettingsLayout() {
  return (
    <div>
      <PageHeader emoji="⚙️" title="Settings" description="Your profile, appearance, security and data." />
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        <nav aria-label="Settings" className="md:w-48 md:shrink-0">
          <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:flex-col md:overflow-visible">
            {TABS.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink to={to} className={tabClass}>
                  <Icon aria-hidden className="size-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-2xl flex-1 space-y-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
