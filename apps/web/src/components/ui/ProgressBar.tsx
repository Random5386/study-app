// A chunky rounded bar with a shine on top, like a game's progress bar.
type ProgressBarProps = {
  value: number;
  max: number;
  label: string; // for screen readers, e.g. "Storage used"
  colour?: string; // a Tailwind bg-* class
  size?: 'sm' | 'md';
};

export function ProgressBar({ value, max, label, colour = 'bg-brand-500', size = 'md' }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={`w-full overflow-hidden rounded-full bg-line ${size === 'sm' ? 'h-2.5' : 'h-4'}`}
    >
      <div
        className={`relative h-full rounded-full transition-[width] duration-500 ${colour}`}
        style={{ width: `${percent}%` }}
      >
        {size === 'md' && percent > 6 && (
          <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-white/35" aria-hidden />
        )}
      </div>
    </div>
  );
}
