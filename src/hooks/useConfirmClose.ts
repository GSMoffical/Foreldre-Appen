import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a guarded close callback that prompts the user
 * when the form has unsaved changes (isDirty = true).
 * Also wires up the beforeunload browser event.
 */
export function useConfirmClose(isDirty: boolean, onClose: () => void) {
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty

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
      if (!window.confirm('You have unsaved changes. Leave anyway?')) return
    }
    onClose()
  }, [onClose])

  return guardedClose
}
