import { useState, useRef, useCallback, type ReactNode } from 'react'

interface SwipeableEventRowProps {
  children: ReactNode
  onDelete: () => void
}

const SWIPE_THRESHOLD = 80
const DELETE_WIDTH = 80

export function SwipeableEventRow({ children, onDelete }: SwipeableEventRowProps) {
  const [offsetX, setOffsetX] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null)
  const lockedAxis = useRef<'x' | 'y' | null>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    lockedAxis.current = null
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startRef.current || startRef.current.id !== e.pointerId) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y

    if (!lockedAxis.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        lockedAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      return
    }

    if (lockedAxis.current !== 'x') return

    const base = revealed ? -DELETE_WIDTH : 0
    const raw = base + dx
    setOffsetX(Math.min(0, Math.max(-DELETE_WIDTH * 1.5, raw)))
  }, [revealed])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!startRef.current || startRef.current.id !== e.pointerId) return
    const dx = e.clientX - startRef.current.x
    startRef.current = null

    if (lockedAxis.current !== 'x') {
      setOffsetX(revealed ? -DELETE_WIDTH : 0)
      return
    }

    if (!revealed && dx < -SWIPE_THRESHOLD) {
      setRevealed(true)
      setOffsetX(-DELETE_WIDTH)
    } else if (revealed && dx > SWIPE_THRESHOLD / 2) {
      setRevealed(false)
      setOffsetX(0)
    } else {
      setOffsetX(revealed ? -DELETE_WIDTH : 0)
    }
  }, [revealed])

  function handleDeleteClick() {
    onDelete()
    setRevealed(false)
    setOffsetX(0)
  }

  return (
    <div className="relative overflow-hidden rounded-card">
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-rose-600"
        style={{ width: DELETE_WIDTH }}
      >
        <button
          type="button"
          onClick={handleDeleteClick}
          className="flex h-full w-full items-center justify-center text-body-sm font-semibold text-white"
          aria-label="Slett hendelse"
        >
          Slett
        </button>
      </div>

      <div
        className="relative bg-white transition-transform"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: startRef.current ? 'none' : 'transform 0.2s ease-out',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {children}
      </div>
    </div>
  )
}
