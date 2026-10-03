// The frame around every page: a sidebar with navigation and a main area.
// <Outlet /> is where React Router renders the current page.
import { NavLink, Outlet } from 'react-router';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/documents', label: 'Study guides' },
  { to: '/notes', label: 'Notes' },
  { to: '/decks', label: 'Flashcards' },
  { to: '/study', label: 'Study' },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="w-56 shrink-0 border-r border-slate-200 p-4 dark:border-slate-800">
        <p className="mb-6 text-lg font-bold text-indigo-600 dark:text-indigo-400">StudyApp</p>
        <nav aria-label="Main">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? 'bg-indigo-100 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
