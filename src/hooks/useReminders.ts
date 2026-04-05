import { useEffect, useRef } from 'react'
import type { Event } from '../types'
import { parseTime } from '../lib/time'
import { todayKeyOslo } from '../lib/osloCalendar'

/**
 * Schedules browser notifications for Oslo-today events that have reminderMinutes set.
 */
export function useReminders(events: Event[], osloTodayKey: string) {
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (osloTodayKey !== todayKeyOslo()) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const timers: ReturnType<typeof setTimeout>[] = []

    for (const ev of events) {
      if (ev.reminderMinutes == null) continue
      const reminderKey = `${ev.id}-${ev.reminderMinutes}`
      if (firedRef.current.has(reminderKey)) continue

      const eventStartMin = parseTime(ev.start)
      const reminderMin = eventStartMin - ev.reminderMinutes

      if (reminderMin <= nowMinutes) {
        if (eventStartMin > nowMinutes) {
          fireNotification(ev)
          firedRef.current.add(reminderKey)
        }
        continue
      }

      const delayMs = (reminderMin - nowMinutes) * 60 * 1000
      const timer = setTimeout(() => {
        fireNotification(ev)
        firedRef.current.add(reminderKey)
      }, delayMs)
      timers.push(timer)
    }

    return () => timers.forEach(clearTimeout)
  }, [events, osloTodayKey])
}

function fireNotification(ev: Event) {
  try {
    new Notification(`${ev.title} starter om ${ev.reminderMinutes} min`, {
      body: `${ev.start} – ${ev.end}`,
      icon: '/favicon.svg',
      tag: ev.id,
    })
  } catch {
    // Notification API may not be available
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}
