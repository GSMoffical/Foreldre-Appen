import ellipseMint from '../../assets/synka-ellipse-mint.svg'
import ellipseYellow from '../../assets/synka-ellipse-yellow.svg'

export type SynkaDecorativeShapeVariant = 'mint' | 'yellow'

interface SynkaDecorativeShapeProps {
  variant: SynkaDecorativeShapeVariant
  /** Width (and height) in px — shapes are always square */
  size?: number
  className?: string
  style?: React.CSSProperties
  opacity?: number
}

/**
 * Renders the branded ellipse accent shapes from design assets.
 * These are the same shapes used in the Synka logo.
 * Mint = `#7BC7C4`, Yellow = `#F4D35E`
 */
export function SynkaDecorativeShape({
  variant,
  size = 88,
  className = '',
  style,
  opacity = 1,
}: SynkaDecorativeShapeProps) {
  return (
    <img
      src={variant === 'mint' ? ellipseMint : ellipseYellow}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
      style={{ opacity, ...style }}
    />
  )
}
