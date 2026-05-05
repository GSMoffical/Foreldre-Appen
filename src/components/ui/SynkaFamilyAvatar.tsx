import { motion } from 'framer-motion'

export type SynkaFamilyAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface SynkaFamilyAvatarProps {
  name: string
  /** Person's brand color — used as bg when active, text when inactive */
  colorAccent: string
  /** Person's tint — used as bg when inactive */
  colorTint: string
  size?: SynkaFamilyAvatarSize
  /** Whether this person is currently selected/active */
  active?: boolean
  /** Whether this represents the signed-in user */
  isMe?: boolean
  onClick?: () => void
  className?: string
}

const sizeMap: Record<SynkaFamilyAvatarSize, { dim: string; text: string }> = {
  xs: { dim: 'h-6 w-6',  text: 'text-[10px]' },
  sm: { dim: 'h-7 w-7',  text: 'text-[11px]' },
  md: { dim: 'h-9 w-9',  text: 'text-[13px]' },
  lg: { dim: 'h-11 w-11', text: 'text-[15px]' },
  xl: { dim: 'h-14 w-14', text: 'text-[18px]' },
}

/**
 * A family member's avatar — round, color-coded, initial-based.
 * When `onClick` is provided it behaves as a filter toggle button.
 */
export function SynkaFamilyAvatar({
  name,
  colorAccent,
  colorTint,
  size = 'md',
  active = true,
  isMe = false,
  onClick,
  className = '',
}: SynkaFamilyAvatarProps) {
  const { dim, text } = sizeMap[size]
  const initial = name.charAt(0).toUpperCase()

  const inner = (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold transition-all duration-150 ${dim} ${text} ${className}`}
      style={{
        backgroundColor: active ? colorAccent : colorTint,
        color: active ? '#fff' : colorAccent,
        outline: isMe ? `2px solid ${colorAccent}` : 'none',
        outlineOffset: '2px',
      }}
      aria-label={isMe ? `${name} (deg)` : name}
    >
      {initial}
    </span>
  )

  if (!onClick) return inner

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      aria-pressed={active}
      className="touch-manipulation"
    >
      {inner}
    </motion.button>
  )
}
