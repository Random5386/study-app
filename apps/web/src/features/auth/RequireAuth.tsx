// Sends signed-out visitors to /login. This is for a smooth experience only:
// the real protection is on the server (requireAuth), because anything in the browser can be bypassed.
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from './useMe';

export function RequireAuth() {
  const { data: me, isPending, isError } = useMe();
  const location = useLocation();

  if (isPending) return <p className="grid min-h-screen place-items-center text-sm text-muted">Loading…</p>;
  if (isError)
    return (
      <p className="p-8 text-sm text-danger-600">Could not reach the server. Is `npm run dev` running?</p>
    );
  if (!me) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** The opposite: signed-in users visiting /login or /register go to the dashboard. */
export function PublicOnly() {
  const { data: me, isPending } = useMe();
  if (isPending) return null;
  if (me) return <Navigate to="/" replace />;
  return <Outlet />;
}
