import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2">
        <Link to="/" className="text-indigo-600 underline dark:text-indigo-400">
          Back to the dashboard
        </Link>
      </p>
    </section>
  );
}
