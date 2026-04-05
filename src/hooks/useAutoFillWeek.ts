import { useEffect } from 'react'
import type { WeekDayLayout } from './useScheduleState'
import type { Event } from '../types'

export interface AutoFillContext {
  week: WeekDayLayout[]
  addEvent: (date: string, input: Omit<Event, 'id'>) => Promise<void> | void
  addRecurring: (
    startDate: string,
    endDate: string,
    intervalDays: number,
    input: Omit<Event, 'id'>
  ) => Promise<void> | void
  clearAllEvents: () => Promise<void> | void
}

/**
 * Hook reserved for future automatic calendar-filling features.
 * Integrations can import this hook and implement their own behaviour
 * without changing the core calendar state or components.
 */
export function useAutoFillWeek(_ctx: AutoFillContext | null) {
  useEffect(() => {
    // No-op for now. Future auto-fill logic can subscribe to _ctx changes here.
  }, [_ctx])
}

