import { type ReactNode } from 'react'

interface MobileFrameProps {
  children: ReactNode
}

/** Root app surface: full width/height on phone and iPad (no simulated device frame). */
export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="mobile-app-frame max-w-full flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] bg-surface">
      {children}
    </div>
  )
}
