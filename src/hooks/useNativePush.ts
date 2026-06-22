import { useEffect } from 'react'
import { registerPushNotifications } from '../lib/push'

export function useNativePush(userId: string | null): void {
  useEffect(() => {
    if (!userId) return
    void registerPushNotifications(userId)
  }, [userId])
}
