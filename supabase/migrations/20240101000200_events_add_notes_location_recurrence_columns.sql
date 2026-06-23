-- Run this in Supabase SQL Editor if events table already exists but is missing columns.
-- Adds notes, location, recurrence, reminders, and metadata so the app can save events without errors.

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS reminder_minutes int;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS metadata jsonb;
