-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Add role column to profiles table
-- Run this in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Add role column with default 'user'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'moderator'));

-- 2. Update the handle_new_user trigger to include role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'role', 'user')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Set YOUR account to admin (shymom)
UPDATE public.profiles
  SET role = 'admin'
  WHERE username = 'shymom';

-- 4. Verify
SELECT id, username, role FROM public.profiles WHERE username = 'shymom';
