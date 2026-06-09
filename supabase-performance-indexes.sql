-- Synka: Performance indexes
-- Run each statement separately in the Supabase SQL Editor.
-- The SQL Editor runs inside a transaction block, so CONCURRENTLY
-- cannot be used. These are safe to run on a live database with no
-- real users — they will briefly lock each table during creation.
--
-- These indexes cover the most common query patterns in the app:
-- calendar views, notification fetches, and RLS policy subqueries.

-- events: day view query (user_id + exact date)
CREATE INDEX IF NOT EXISTS idx_events_user_date
  ON public.events (user_id, date);

-- events: person_id lookup (used when deleting a family member)
CREATE INDEX IF NOT EXISTS idx_events_user_person
  ON public.events (user_id, person_id);

-- events: start time ordering within a day or date range
CREATE INDEX IF NOT EXISTS idx_events_user_date_start
  ON public.events (user_id, date, start);

-- notifications: fetch notifications for a user ordered by date
CREATE INDEX IF NOT EXISTS idx_notifications_target_user
  ON public.notifications (target_user_id, created_at DESC);

-- notifications: unread notifications filter
CREATE INDEX IF NOT EXISTS idx_notifications_target_unread
  ON public.notifications (target_user_id, read_at)
  WHERE read_at IS NULL;

-- family_links: RLS policy subquery on linked_to_user_id
-- Used in RLS policies for events AND tasks on every row returned.
-- Missing this index causes a sequential scan on every data fetch.
CREATE INDEX IF NOT EXISTS idx_family_links_linked_to
  ON public.family_links (linked_to_user_id);

-- family_members: sort_order for display ordering
CREATE INDEX IF NOT EXISTS idx_family_members_user_sort
  ON public.family_members (user_id, sort_order);
