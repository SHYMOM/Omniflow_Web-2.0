-- ═══════════════════════════════════════════════════════════════
-- RUN THIS in the Supabase SQL Editor to:
--   1. Fix RLS recursion (if nuclear_reset wasn't run yet)
--   2. Add media_ads + system_settings tables
-- ═══════════════════════════════════════════════════════════════

-- STEP 1: Ensure the is_admin() SECURITY DEFINER helper exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- STEP 2: Fix profiles RLS — drop the old recursive policies and recreate
DO $$
BEGIN
  -- Drop old policies that may cause recursion
  DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;
  DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
  DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
END $$;

-- Recreate safe profiles policies
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- STEP 3: Fix system_logs RLS
DO $$
BEGIN
  DROP POLICY IF EXISTS "Only admins can read system logs" ON public.system_logs;
  DROP POLICY IF EXISTS "Anyone can insert logs" ON public.system_logs;
  DROP POLICY IF EXISTS "Only admins can delete logs" ON public.system_logs;
  DROP POLICY IF EXISTS "system_logs_insert_public" ON public.system_logs;
  DROP POLICY IF EXISTS "system_logs_select_admin" ON public.system_logs;
  DROP POLICY IF EXISTS "system_logs_delete_admin" ON public.system_logs;
END $$;

CREATE POLICY "system_logs_insert_public"
  ON public.system_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "system_logs_select_admin"
  ON public.system_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "system_logs_delete_admin"
  ON public.system_logs FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- STEP 4: Create media_ads table
CREATE TABLE IF NOT EXISTS public.media_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    target_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.media_ads ENABLE ROW LEVEL SECURITY;

-- Drop any old policies first
DO $$
BEGIN
  DROP POLICY IF EXISTS "media_ads_select_public" ON public.media_ads;
  DROP POLICY IF EXISTS "media_ads_insert_admin" ON public.media_ads;
  DROP POLICY IF EXISTS "media_ads_update_admin" ON public.media_ads;
  DROP POLICY IF EXISTS "media_ads_delete_admin" ON public.media_ads;
END $$;

CREATE POLICY "media_ads_select_public"
    ON public.media_ads FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "media_ads_insert_admin"
    ON public.media_ads FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "media_ads_update_admin"
    ON public.media_ads FOR UPDATE
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "media_ads_delete_admin"
    ON public.media_ads FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- STEP 5: Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "system_settings_select_public" ON public.system_settings;
  DROP POLICY IF EXISTS "system_settings_manage_admin" ON public.system_settings;
END $$;

CREATE POLICY "system_settings_select_public"
    ON public.system_settings FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "system_settings_manage_admin"
    ON public.system_settings FOR ALL
    TO authenticated
    USING (public.is_admin());

INSERT INTO public.system_settings (key, value)
VALUES ('global_ads_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DONE. Admin dashboard should stop timing out now.
-- ═══════════════════════════════════════════════════════════════
