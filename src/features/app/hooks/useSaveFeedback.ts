import { useCallback, useEffect, useRef, useState } from 'react'
import { triggerLightHaptic } from '../../../lib/haptics'

export type SaveFeedbackState = 'saving' | 'saved' | 'error' | null

export function useSaveFeedback(hapticsEnabled: boolean) {
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedbackState>(null)
  const saveFeedbackTimeoutRef = useRef<number | null>(null)

  const clearFeedbackTimer = useCallback(() => {
    if (saveFeedbackTimeoutRef.current != null) {
      window.clearTimeout(saveFeedbackTimeoutRef.current)
      saveFeedbackTimeoutRef.current = null
    }
  }, [])

  const showSaveFeedback = useCallback(() => {
    triggerLightHaptic(hapticsEnabled)
    clearFeedbackTimer()
    setSaveFeedback('saved')
    saveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSaveFeedback(null)
      saveFeedbackTimeoutRef.current = null
    }, 2000)
  }, [clearFeedbackTimer, hapticsEnabled])

  const showSavingFeedback = useCallback(() => {
    clearFeedbackTimer()
    setSaveFeedback('saving')
  }, [clearFeedbackTimer])

  const showSaveError = useCallback(() => {
    clearFeedbackTimer()
    setSaveFeedback('error')
    saveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSaveFeedback(null)
      saveFeedbackTimeoutRef.current = null
    }, 3000)
  }, [clearFeedbackTimer])

  useEffect(() => clearFeedbackTimer, [clearFeedbackTimer])

  return {
    saveFeedback,
    showSaveFeedback,
    showSavingFeedback,
    showSaveError,
  }
}
