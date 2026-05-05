import { forwardRef } from 'react'
import { motion } from 'framer-motion'

export type SynkaButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
export type SynkaButtonSize = 'sm' | 'md' | 'lg'
/** `pill` = rounded-full (CTAs, add actions) · `rect` = rounded-md (secondary, inline) */
export type SynkaButtonShape = 'pill' | 'rect'

export interface SynkaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SynkaButtonVariant
  size?: SynkaButtonSize
  shape?: SynkaButtonShape
  /** Shows loading dots and disables the button */
  loading?: boolean
}

const base =
  'font-semibold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 touch-manipulation select-none'

const variants: Record<SynkaButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white border border-transparent hover:bg-primary-700 active:bg-[#0f3724] focus:ring-primary-500 disabled:bg-[#b9cdc1] disabled:text-white',
  secondary:
    'bg-transparent text-primary-700 border border-primary-700 hover:bg-primary-50 active:bg-primary-100 focus:ring-primary-500 disabled:text-[#b9cdc1] disabled:border-[#d2dcd5] disabled:bg-transparent',
  ghost:
    'bg-transparent text-primary-700 border border-transparent hover:bg-primary-50 active:bg-primary-100 focus:ring-primary-500 disabled:text-[#b9cdc1] disabled:bg-transparent',
  danger:
    'bg-semantic-red-500 text-white border border-transparent hover:bg-semantic-red-600 active:bg-semantic-red-700 focus:ring-semantic-red-500 disabled:bg-[#f3c4c2] disabled:text-white',
  icon:
    'bg-primary-600 text-white border border-transparent hover:bg-primary-700 active:bg-[#0f3724] focus:ring-primary-500 disabled:bg-[#b9cdc1] disabled:text-white',
}

const sizes: Record<SynkaButtonSize, string> = {
  sm: 'h-9 px-4 text-[13px]',
  md: 'h-11 px-5 text-[14px]',
  lg: 'h-12 px-7 text-[15px]',
}

const iconSizes: Record<SynkaButtonSize, string> = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-12 h-12',
}

const LoadingDots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '120ms' }} />
    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '240ms' }} />
  </span>
)

export const SynkaButton = forwardRef<HTMLButtonElement, SynkaButtonProps>(
  ({ variant = 'primary', size = 'md', shape = 'rect', loading = false, className = '', children, disabled, ...props }, ref) => {
    const isIcon = variant === 'icon'
    const radiusClass = shape === 'pill' ? 'rounded-full' : 'rounded-md'
    const sizeClass = isIcon ? iconSizes[size] : sizes[size]
    const layoutClass = isIcon
      ? 'flex items-center justify-center'
      : 'inline-flex items-center justify-center gap-2'
    const cls = `${base} ${variants[variant]} ${sizeClass} ${radiusClass} ${layoutClass} ${className}`.trim()

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cls}
        whileTap={disabled || loading ? undefined : { scale: 0.97 }}
        transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
        {...(props as any)}
      >
        {loading ? <LoadingDots /> : children}
      </motion.button>
    )
  },
)
SynkaButton.displayName = 'SynkaButton'
