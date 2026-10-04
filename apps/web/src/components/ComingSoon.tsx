// Placeholder for pages that later phases will build. Friendly, and says what's coming.
import { Link } from 'react-router';
import { buttonClass } from './ui/buttonClass';
import { PageHeader } from './ui/PageHeader';

type ComingSoonProps = { title: string; phase: number; emoji: string; teaser: string };

export function ComingSoon({ title, phase, emoji, teaser }: ComingSoonProps) {
  return (
    <section>
      <PageHeader emoji={emoji} title={title} description={teaser} />
      <div className="rounded-2xl border-2 border-dashed border-line-strong p-8 text-center">
        <p className="font-display text-xl font-black">Under construction 🚧</p>
        <p className="mx-auto mt-2 max-w-md text-muted">
          This part of the app arrives in phase {phase} of the build roadmap. Meanwhile, you can upload and
          organise your study guides.
        </p>
        <Link to="/documents" className={buttonClass('primary', 'md', 'mt-5')}>
          Go to study guides
        </Link>
      </div>
    </section>
  );
}
