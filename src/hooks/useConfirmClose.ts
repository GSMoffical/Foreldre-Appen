import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Returns guarded-close helpers that surface an inline confirmation panel
 * instead of a browser-native window.confirm() when the form is dirty.
 *
 * Usage:
 *   const { guardedClose, confirming, confirmClose, cancelConfirm } = useConfirmClose(isDirty, onClose)
 *
 *   - Call `guardedClose` wherever you would have called onClose (backdrop, Escape, Avbryt).
 *   - Render a confirmation panel in the sheet when `confirming` is true, wired to
 *     `confirmClose` (proceed) and `cancelConfirm` (stay).
 */
export function useConfirmClose(isDirty: boolean, onClose: () => void) {
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty

  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const guardedClose = useCallback(() => {
    if (dirtyRef.current) {
      setConfirming(true)
      return
    }
    onClose()
  }, [onClose])

  const confirmClose = useCallback(() => {
    setConfirming(false)
    onClose()
  }, [onClose])

  const cancelConfirm = useCallback(() => {
    setConfirming(false)
  }, [])

  return { guardedClose, confirming, confirmClose, cancelConfirm }
}
