import { Link } from 'react-router';
import { buttonClass } from './ui/buttonClass';

export function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <p aria-hidden className="text-6xl">
        🧭
      </p>
      <h1 className="mt-4 text-3xl font-black">Page not found</h1>
      <p className="mt-2 text-muted">This page wandered off. Let’s get you back on track.</p>
      <Link to="/" className={buttonClass('primary', 'md', 'mt-6')}>
        Back to home
      </Link>
    </section>
  );
}
