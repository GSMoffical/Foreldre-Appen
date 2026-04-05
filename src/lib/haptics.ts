/** True when primary input is coarse (typisk mobil / touch). */
export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

/** Short vibration on supported browsers (often Android Chrome; many iOS browsers omit vibrate). */
export function triggerLightHaptic(enabled: boolean): void {
  if (!enabled || !isCoarsePointer()) return
  try {
    navigator.vibrate?.(12)
  } catch {
    // ignore
  }
}
