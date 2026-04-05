-- Fix profiles table so the app works (id as PK, display_name, family_name, updated_at).
-- Run in Supabase SQL Editor if your profiles table has different columns (e.g. id but no family_name).

-- Add missing columns to profiles if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS family_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- If your table uses user_id as the primary key instead of id, uncomment and run this instead,
-- then in the app we use PROFILES_PK = 'user_id'. Otherwise ensure the table has id uuid PRIMARY KEY REFERENCES auth.users(id).

-- ALTER TABLE public.profiles RENAME COLUMN id TO user_id;  -- only if your PK is currently named id but should be user_id
