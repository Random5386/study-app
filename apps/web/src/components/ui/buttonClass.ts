// Chunky "3D" buttons, inspired by Duolingo: a darker bottom edge that squashes when pressed.
// buttonClass() gives a <Link> the same look, so links that act like buttons match.
// (It lives in its own file so Vite's fast refresh keeps working for Button.tsx.)

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex select-none items-center justify-center gap-2 rounded-xl font-display font-extrabold tracking-wide transition-[transform,border-width,background-color,margin] duration-75 disabled:cursor-not-allowed disabled:opacity-60';

// The 3D effect: a thick bottom border. When pressed, the border shrinks and the button moves down.
const PRESS =
  'border-b-4 active:enabled:translate-y-[2px] active:enabled:border-b-2 active:enabled:mb-[2px] [a&]:active:translate-y-[2px] [a&]:active:border-b-2 [a&]:active:mb-[2px]';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${PRESS} bg-brand-600 border-brand-700 text-white hover:enabled:bg-[#2f8c00] [a&]:hover:bg-[#2f8c00]`,
  secondary: `${PRESS} border-2 border-b-4 border-line-strong bg-surface text-ink hover:enabled:bg-raised [a&]:hover:bg-raised`,
  danger: `${PRESS} bg-danger-600 border-danger-700 text-white hover:enabled:bg-[#e03d3d] [a&]:hover:bg-[#e03d3d]`,
  ghost: 'text-muted hover:enabled:bg-hover hover:enabled:text-ink [a&]:hover:bg-hover',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-[0.95rem]',
  lg: 'px-6 py-3.5 text-base',
};

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}
