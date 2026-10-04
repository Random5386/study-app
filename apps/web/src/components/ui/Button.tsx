// A <button> with the chunky 3D look from buttonClass.ts and a loading state.
import type { ButtonHTMLAttributes } from 'react';
import { LoaderCircle } from 'lucide-react';
import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonClass';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, `${fullWidth ? 'w-full' : ''} ${className}`)}
      {...rest}
    >
      {loading ? (
        <>
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
          Please wait…
        </>
      ) : (
        children
      )}
    </button>
  );
}
