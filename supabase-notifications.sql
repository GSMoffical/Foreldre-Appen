-- Persistent notification inbox for parent-to-parent notifications.
-- Run in Supabase SQL Editor.
--
-- Purpose: when a parent taps the bell icon on a task, we want the notification
-- to persist even if the recipient's app is closed or backgrounded.
-- The existing Realtime Broadcast handles the online case (instant delivery).
-- This table handles the offline case (notification waiting when they next open the app).

CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_user_id   uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text       NOT NULL,
  body           text       NOT NULL,
  entity_id      text,      -- optional: task or event id for future deep-linking
  entity_kind    text,      -- 'task' | 'event'
  read_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup for unread badge count
CREATE INDEX IF NOT EXISTS notifications_target_unread_idx
  ON public.notifications(target_user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Full replica identity required for filtered Realtime postgres_changes subscriptions
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ── RLS Policies ────────────────────────────────────────────────────────────

-- Users can only read their own notifications
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = target_user_id);

-- A user can insert a notification IF:
--   1. They are the sender (from_user_id = their auth.uid())
--   2. The recipient is either themselves OR a linked family member
CREATE POLICY "notifications_insert_family"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND (
      target_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.family_links
        WHERE
          (user_id = auth.uid()         AND linked_to_user_id = target_user_id)
          OR (user_id = target_user_id  AND linked_to_user_id = auth.uid())
      )
    )
  );

-- Users can mark their own received notifications as read (set read_at)
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING  (auth.uid() = target_user_id)
  WITH CHECK (auth.uid() = target_user_id);

-- Users can delete (dismiss) their own received notifications
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE
  USING (auth.uid() = target_user_id);

-- ── Realtime ─────────────────────────────────────────────────────────────────

-- Add to the supabase_realtime publication so INSERT events stream to subscribers
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
