// The frame around every signed-in page, laid out like Notion: a quiet grey sidebar on the
// left (navigation and the profile menu) and the page itself on the right.
// On phones the sidebar slides in from a menu button. <Outlet /> renders the current page.
import { useState } from 'react';
import { Menu as MenuIcon, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Wordmark } from './Logo';
import { ProfileMenu } from './ProfileMenu';

const NAV_ITEMS = [
  { to: '/', emoji: '🏠', label: 'Home', end: true },
  { to: '/documents', emoji: '📚', label: 'Study guides' },
  { to: '/notes', emoji: '📝', label: 'Notes', soon: true },
  { to: '/decks', emoji: '🃏', label: 'Flashcards', soon: true },
  { to: '/study', emoji: '🎯', label: 'Study', soon: true },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[0.95rem] transition-colors ${
    isActive ? 'bg-hover font-semibold text-ink' : 'text-muted hover:bg-hover hover:text-ink'
  }`;

function SidebarContent() {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link to="/" className="rounded-lg px-2 py-1.5 hover:bg-hover">
        <Wordmark />
      </Link>

      <nav aria-label="Main" className="flex-1">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end} className={navClass}>
                <span aria-hidden className="w-5 text-center text-base">
                  {item.emoji}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.soon && (
                  <span className="rounded-md bg-hover px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-muted">
                    Soon
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line pt-2">
        <ProfileMenu />
      </div>
    </div>
  );
}

export function AppLayout() {
  // The phone menu remembers which page it was opened on, so it closes by itself after navigating.
  const { pathname } = useLocation();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  return (
    <div className="min-h-screen bg-canvas text-ink lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Phones and tablets: a top bar with a menu button */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link to="/">
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="rounded-lg p-2 hover:bg-hover"
        >
          <MenuIcon aria-hidden className="size-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="animate-pop-in absolute inset-y-0 left-0 w-72 border-r border-line bg-sidebar">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-3 right-3 rounded-lg p-1.5 hover:bg-hover"
            >
              <X aria-hidden className="size-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop: a fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <main id="main" className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-14 lg:py-12">
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
