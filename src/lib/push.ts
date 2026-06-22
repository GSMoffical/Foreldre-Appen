import { isNative } from './capacitor'
import { supabase } from './supabaseClient'

export async function registerPushNotifications(userId: string): Promise<void> {
  if (!isNative()) return

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    const permStatus = await PushNotifications.checkPermissions()
    let granted = permStatus.receive

    if (granted === 'prompt') {
      const result = await PushNotifications.requestPermissions()
      granted = result.receive
    }

    if (granted !== 'granted') return

    await PushNotifications.addListener('registration', async (token) => {
      const { error } = await supabase.from('device_tokens').upsert(
        { user_id: userId, token: token.value, platform: 'ios', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      )
      if (error) console.error('[push] Failed to store device token:', error)
    })

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] Registration error:', err)
    })

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.info('[push] Foreground notification received:', notification)
    })

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.info('[push] Notification action performed:', action)
    })

    await PushNotifications.register()
  } catch (err) {
    console.error('[push] Unexpected error during push registration:', err)
  }
}
