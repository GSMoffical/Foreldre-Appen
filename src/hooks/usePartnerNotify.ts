import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fireNotification } from '../lib/notifyPartner'
import { insertNotification } from '../lib/notificationsApi'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface UsePartnerNotifyOptions {
  /**
   * The family-owner's auth ID — used as the Realtime Broadcast channel key.
   * Same for both the owner and any linked partner. Pass null to disable.
   */
  effectiveUserId: string | null
  /**
   * The REAL auth.uid() of the user calling this hook (the sender).
   * Used as from_user_id in the DB notification row.
   */
  currentUserId: string | null
  /**
   * The REAL auth.uid() of the partner to notify (the recipient).
   * Owner's partner = linked user's linkedAuthUserId.
   * Linked user's partner = effectiveUserId (the owner).
   */
  partnerUserId: string | null
}

/**
 * Dual-path partner notification:
 *
 * Fast path  — Supabase Realtime Broadcast on `family-notify:{effectiveUserId}`.
 *              Fires immediately if the partner's app is open and subscribed.
 *              The receiving side fires a browser Notification on their device.
 *
 * Persistent path — inserts a row into `public.notifications` so the notification
 *                   survives if the partner was offline or the app was backgrounded.
 *                   Picked up by `useNotifications` when they next open the app.
 */
export function usePartnerNotify({
  effectiveUserId,
  currentUserId,
  partnerUserId,
}: UsePartnerNotifyOptions): {
  sendTaskNotify: (taskTitle: string, taskId?: string, taskNote?: string) => Promise<void>
} {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!effectiveUserId) return

    const ch = supabase
      .channel(`family-notify:${effectiveUserId}`, {
        config: { broadcast: { self: false } },
      })
      .on('broadcast', { event: 'task_notify' }, ({ payload }) => {
        const p = payload as { taskTitle?: string; taskNote?: string }
        const title = p?.taskTitle ?? 'Gjøremål'
        const note = p?.taskNote?.trim().slice(0, 120)
        const body = note ? `Ikke glem: ${title} – ${note}` : `Ikke glem: ${title}`
        fireNotification('ForeldrePortalen', body)
      })
      .subscribe()

    channelRef.current = ch

    return () => {
      void supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [effectiveUserId])

  const sendTaskNotify = useCallback(
    async (taskTitle: string, taskId?: string, taskNote?: string): Promise<void> => {
      const note = taskNote?.trim().slice(0, 120) || undefined
      const body = note ? `Ikke glem: ${taskTitle} – ${note}` : `Ikke glem: ${taskTitle}`
      // Fast path: Realtime Broadcast (instant if partner's app is open)
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'task_notify',
          payload: { taskTitle, taskNote: note },
        })
      }

      // Persistent path: DB row so the notification survives app closure
      if (currentUserId && partnerUserId) {
        void insertNotification({
          fromUserId: currentUserId,
          targetUserId: partnerUserId,
          title: 'ForeldrePortalen',
          body,
          entityId: taskId,
          entityKind: taskId ? 'task' : undefined,
        })
      }
    },
    [currentUserId, partnerUserId]
  )

  return { sendTaskNotify }
}
