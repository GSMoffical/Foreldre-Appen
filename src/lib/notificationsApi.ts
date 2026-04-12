import { supabase } from './supabaseClient'

export interface NotificationRow {
  id: string
  from_user_id: string
  title: string
  body: string
  entity_id: string | null
  entity_kind: string | null
  read_at: string | null
  created_at: string
}

export async function insertNotification(params: {
  targetUserId: string
  fromUserId: string
  title: string
  body: string
  entityId?: string
  entityKind?: string
}): Promise<boolean> {
  const { error } = await supabase.from('notifications').insert({
    target_user_id: params.targetUserId,
    from_user_id: params.fromUserId,
    title: params.title,
    body: params.body,
    entity_id: params.entityId ?? null,
    entity_kind: params.entityKind ?? null,
  })
  if (error) {
    console.error('[notificationsApi] insert failed', error.message)
    return false
  }
  return true
}

export async function fetchUnreadNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, from_user_id, title, body, entity_id, entity_kind, read_at, created_at')
    .eq('target_user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error('[notificationsApi] fetch failed', error.message)
    return []
  }
  return data ?? []
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('target_user_id', userId)
    .is('read_at', null)
  if (error) {
    console.error('[notificationsApi] markAllRead failed', error.message)
  }
}

export async function deleteSingleNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) {
    console.error('[notificationsApi] delete failed', error.message)
  }
}
