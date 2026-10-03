// The frame around every signed-in page: a sidebar with navigation and the account
// menu, plus the main area. <Outlet /> is where React Router renders the current page.
import { NavLink, Outlet } from 'react-router';
import { useLogout } from '../features/auth/useLogout';
import { useMe } from '../features/auth/useMe';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/documents', label: 'Study guides' },
  { to: '/notes', label: 'Notes' },
  { to: '/decks', label: 'Flashcards' },
  { to: '/study', label: 'Study' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm ${
    isActive
      ? 'bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
  }`;

export function AppLayout() {
  const { data: me } = useMe();
  const logout = useLogout();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 p-4 dark:border-slate-800">
        <p className="mb-6 text-lg font-bold text-indigo-600 dark:text-indigo-400">StudyApp</p>
        <nav aria-label="Main" className="flex-1">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={linkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="truncate px-3 text-sm font-medium" title={me?.email}>
            {me?.displayName}
          </p>
          <p className="truncate px-3 pb-2 text-xs text-slate-500 dark:text-slate-400">{me?.email}</p>
          <NavLink to="/settings/security" className={linkClass}>
            Security
          </NavLink>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="mt-1 block w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
