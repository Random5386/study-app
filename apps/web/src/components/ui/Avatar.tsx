// A coloured circle with your first initial. The colour comes from your name, so it's stable.
const COLOURS = ['bg-brand-500', 'bg-sky', 'bg-fire', 'bg-grape', 'bg-coral', 'bg-[#2bb5a7]'];

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const sizes = { sm: 'size-6 text-xs', md: 'size-8 text-sm', lg: 'size-16 text-2xl' };
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display font-black text-white ${sizes[size]} ${COLOURS[hash % COLOURS.length]}`}
    >
      {initial}
    </span>
  );
}
