import { useEffect } from 'react'

/** Local hour (0–23) when the UI switches to the warmer “evening” paper surface. */
const EVENING_START_HOUR = 18

/**
 * Subtle flat warm shift for `bg-surface` after 18:00 (still solid color, no gradient).
 * Updates `document.documentElement.dataset.surface` and `theme-color` meta.
 */
export function useTimeOfDaySurface() {
  useEffect(() => {
    function apply() {
      const hour = new Date().getHours()
      const evening = hour >= EVENING_START_HOUR
      document.documentElement.dataset.surface = evening ? 'evening' : 'day'
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) {
        meta.setAttribute('content', evening ? 'rgb(237, 230, 220)' : 'rgb(244, 241, 235)')
      }
    }
    apply()
    const id = window.setInterval(apply, 60_000)
    return () => window.clearInterval(id)
  }, [])
}
