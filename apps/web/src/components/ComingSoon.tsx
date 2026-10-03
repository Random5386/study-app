type ComingSoonProps = { title: string; phase: number };

/** Placeholder for pages that later phases will build. */
export function ComingSoon({ title, phase }: ComingSoonProps) {
  return (
    <section>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Coming in phase {phase} of the build roadmap.</p>
    </section>
  );
}
