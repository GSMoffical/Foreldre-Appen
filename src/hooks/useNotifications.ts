import { useState, useEffect, useCallback, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import {
  fetchUnreadNotifications,
  markAllNotificationsRead,
  deleteSingleNotification,
  type NotificationRow,
} from '../lib/notificationsApi'

export type { NotificationRow }

/**
 * Manages the persistent in-app notification inbox for the current user.
 *
 * Keyed on the user's REAL auth.uid() — NOT effectiveUserId — because
 * notification rows are stored by the recipient's actual auth ID.
 *
 * - Fetches unread notifications on mount and when userId changes.
 * - Subscribes to Realtime postgres_changes INSERT so new rows appear live
 *   (adds to local state only; does NOT double-fire browser notifications
 *   since the Broadcast channel already handles the online case).
 * - markAllRead: marks all unread in the DB. Local state is cleared separately
 *   so the caller can snapshot before clearing (see TasksScreen).
 * - dismiss: deletes a single row from DB and removes from local state.
 */
export function useNotifications(currentUserId: string | null): {
  notifications: NotificationRow[]
  unreadCount: number
  markAllRead: () => Promise<void>
  dismiss: (id: string) => Promise<void>
  clearLocal: () => void
} {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  const load = useCallback(async () => {
    if (!currentUserId) return
    const rows = await fetchUnreadNotifications(currentUserId)
    setNotifications(rows)
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) {
      setNotifications([])
      return
    }

    void load()

    const ch = supabase
      .channel(`inbox:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `target_user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow
          setNotifications((prev) => {
            if (prev.some((n) => n.id === row.id)) return prev
            return [row, ...prev]
          })
        }
      )
      .subscribe()

    channelRef.current = ch

    return () => {
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [currentUserId, load])

  const markAllRead = useCallback(async () => {
    if (!currentUserId) return
    await markAllNotificationsRead(currentUserId)
  }, [currentUserId])

  const dismiss = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await deleteSingleNotification(id)
  }, [])

  const clearLocal = useCallback(() => {
    setNotifications([])
  }, [])

  return {
    notifications,
    unreadCount: notifications.length,
    markAllRead,
    dismiss,
    clearLocal,
  }
}
