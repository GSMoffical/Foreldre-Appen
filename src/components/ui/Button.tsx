import { forwardRef } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'neutral' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Stretch to fill parent width (default true for md/lg, false for sm) */
  fullWidth?: boolean
  /** Shows a spinner and disables the button */
  loading?: boolean
}

const base =
  'inline-flex items-center justify-center font-medium transition active:translate-y-px disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 touch-manipulation select-none'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brandTeal text-white shadow-planner-sm hover:brightness-95 active:shadow-planner-press focus:ring-brandTeal/40',
  secondary:
    'border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100 focus:ring-zinc-300/60',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-500/40',
  neutral:
    'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 focus:ring-zinc-200',
  ghost:
    'text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 focus:ring-zinc-200',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'rounded-xl px-3.5 py-2 text-body-sm',
  md: 'rounded-2xl px-5 py-3 text-body',
  lg: 'rounded-2xl px-5 py-3.5 text-subheading',
}

const defaultWidth: Record<ButtonSize, boolean> = {
  sm: false,
  md: true,
  lg: true,
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth,
      loading = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isFullWidth = fullWidth ?? defaultWidth[size]
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${isFullWidth ? 'w-full' : ''} ${className}`.trim()}
        {...props}
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          children
        )}
      </button>
    )
  },
)
Button.displayName = 'Button'
