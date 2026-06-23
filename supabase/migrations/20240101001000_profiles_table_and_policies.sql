-- Profiles: display name (who you are) and family name (when you're the owner).
-- Run in Supabase SQL Editor after supabase-setup and supabase-invites.

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  family_name text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own row
CREATE POLICY "Users can manage own profile"
  ON public.profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Linked users can read the owner's profile (to show family name)
CREATE POLICY "Linked users can read owner profile"
  ON public.profiles FOR SELECT
  USING (
    user_id IN (SELECT linked_to_user_id FROM public.family_links WHERE user_id = auth.uid())
  );
