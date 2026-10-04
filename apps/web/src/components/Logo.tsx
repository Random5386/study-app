// The app's mark: an open book on a green "3D" tile. Original artwork, drawn here in SVG.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#58cc02" />
      <rect y="26" width="32" height="6" rx="3" fill="#46a302" />
      <path
        d="M9 10.5c2.6-1.4 4.9-1.4 7 0 2.1-1.4 4.4-1.4 7 0v11c-2.6-1.4-4.9-1.4-7 0-2.1-1.4-4.4-1.4-7 0z"
        fill="#fff"
      />
      <path d="M16 10.5v11" stroke="#46a302" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <Logo />
      <span className="font-display text-lg font-black tracking-tight">StudyApp</span>
    </span>
  );
}
