import { useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'

interface UseMobileRefreshTriggersOptions {
  enabled: boolean
  onRefresh: () => void
  includeVisibilityChange?: boolean
  intervalMs?: number
}

export function useMobileRefreshTriggers({
  enabled,
  onRefresh,
  includeVisibilityChange = false,
  intervalMs = 10000,
}: UseMobileRefreshTriggersOptions) {
  useEffect(() => {
    if (!enabled) return

    const trigger = () => onRefresh()
    const onFocus = () => trigger()
    const onPageShow = () => trigger()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        trigger()
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    if (includeVisibilityChange) {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        trigger()
      }
    }, intervalMs)

    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      if (includeVisibilityChange) {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
      window.clearInterval(interval)
    }
  }, [enabled, includeVisibilityChange, intervalMs, onRefresh])
}

interface UseRealtimeRefreshOptions {
  enabled: boolean
  channelName: string
  table: string
  filter: string
  onRefresh: () => void
}

export function useRealtimeRefresh({
  enabled,
  channelName,
  table,
  filter,
  onRefresh,
}: UseRealtimeRefreshOptions) {
  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter,
        },
        () => onRefresh()
      )

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelName, enabled, filter, onRefresh, table])
}
