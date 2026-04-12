const NOTIFY_RATE_LIMIT_MS = 30_000

/**
 * Returns true if a notification for this eventId is allowed now, and records
 * the current timestamp so the next call within 30 s returns false.
 * Returns false without side-effects when still within the cooldown window.
 */
export function checkAndRecordNotify(eventId: string): boolean {
  const key = `foreldre_notified_${eventId}`
  try {
    const last = parseInt(localStorage.getItem(key) ?? '0', 10)
    if (Date.now() - last < NOTIFY_RATE_LIMIT_MS) return false
    localStorage.setItem(key, String(Date.now()))
    return true
  } catch {
    return true
  }
}

/**
 * Fire a browser Notification if the API is available and permission is granted.
 * Safe to call unconditionally — silently no-ops when unavailable or denied.
 */
export function fireNotification(title: string, body: string, tag?: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.svg', tag })
  } catch {
    // Notification API may not be available (e.g. iframe, private mode)
  }
}
