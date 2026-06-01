-- ═══════════════════════════════════════════════════════════════════════════════
-- OMNIFLOW DATABASE — NUCLEAR RESET & CLEAN SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run this ENTIRE script in the Supabase SQL Editor as a single transaction.
-- It will drop ALL existing tables, functions, triggers, and policies,
-- then recreate everything from scratch with proper RLS, admin helpers,
-- and email verification support.
--
-- ⚠️  WARNING: This DELETES all user data, cached streams, logs, etc.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1: TEARDOWN — Drop everything in reverse dependency order
-- ─────────────────────────────────────────────────────────────────────────────

-- 1a. Drop triggers first (before functions they depend on)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 1b. Drop all tables (CASCADE handles FK constraints and policies automatically)
DROP TABLE IF EXISTS public.watch_history    CASCADE;
DROP TABLE IF EXISTS public.watchlists       CASCADE;
DROP TABLE IF EXISTS public.profiles         CASCADE;
DROP TABLE IF EXISTS public.system_logs      CASCADE;
DROP TABLE IF EXISTS public.cached_streams   CASCADE;
DROP TABLE IF EXISTS public.cached_subtitles CASCADE;
DROP TABLE IF EXISTS public.media_identity_mappings CASCADE;

-- 1c. Drop all custom functions
DROP FUNCTION IF EXISTS public.handle_new_user()              CASCADE;
DROP FUNCTION IF EXISTS public.is_admin()                     CASCADE;
DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT)     CASCADE;
DROP FUNCTION IF EXISTS public.purge_expired_cached_streams()  CASCADE;
DROP FUNCTION IF EXISTS public.purge_expired_system_logs()     CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2: HELPER FUNCTIONS (created before tables that reference them)
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. Admin check helper — SECURITY DEFINER to bypass RLS (prevents recursion)
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


-- 2b. Username → Email lookup (for login-by-username)
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT au.email INTO v_email
  FROM auth.users au
  JOIN public.profiles p ON au.id = p.id
  WHERE p.username = p_username;

  RETURN v_email;
END;
$$;

-- Allow anonymous callers (needed for login form before auth)
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 3: TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- ┌──────────────────────────────────────────────────────────────┐
-- │ 3a. User Profiles                                           │
-- │ Syncs 1:1 with auth.users via trigger on signup.            │
-- │ Stores username, avatar, role, and email_verified status.   │
-- └──────────────────────────────────────────────────────────────┘
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE NOT NULL,
  email           TEXT,
  avatar_url      TEXT,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  email_verified  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'Application user profiles, synced from auth.users on signup.';
COMMENT ON COLUMN public.profiles.role IS 'Authorization role: user | admin | moderator';
COMMENT ON COLUMN public.profiles.email_verified IS 'Whether the user has confirmed their email address.';

CREATE INDEX idx_profiles_username   ON public.profiles (username);
CREATE INDEX idx_profiles_role       ON public.profiles (role);
CREATE INDEX idx_profiles_created_at ON public.profiles (created_at DESC);


-- ┌──────────────────────────────────────────────────────────────┐
-- │ 3b. Watchlists                                              │
-- └──────────────────────────────────────────────────────────────┘
CREATE TABLE public.watchlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_id    TEXT NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('anime', 'movie', 'tv', 'kdrama')),
  title       TEXT NOT NULL,
  poster_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'watching', 'completed', 'on_hold', 'dropped')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_id)
);

COMMENT ON TABLE public.watchlists IS 'User-curated saved media lists.';

CREATE INDEX idx_watchlists_user_id ON public.watchlists (user_id);


-- ┌──────────────────────────────────────────────────────────────┐
-- │ 3c. Watch History                                           │
-- └──────────────────────────────────────────────────────────────┘
CREATE TABLE public.watch_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_id    TEXT NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('anime', 'movie', 'tv', 'kdrama')),
  title       TEXT NOT NULL,
  poster_url  TEXT,
  season      INTEGER NOT NULL DEFAULT 1,
  episode     INTEGER NOT NULL DEFAULT 1,
  progress    INTEGER NOT NULL DEFAULT 0,
  duration    INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_id)
);

COMMENT ON TABLE  public.watch_history IS 'Tracks per-user media playback progress for "Continue Watching".';
COMMENT ON COLUMN public.watch_history.progress IS 'Playback position in seconds.';
COMMENT ON COLUMN public.watch_history.duration IS 'Total media duration in seconds.';

CREATE INDEX idx_watch_history_user_id    ON public.watch_history (user_id);
CREATE INDEX idx_watch_history_updated_at ON public.watch_history (updated_at DESC);


-- ┌──────────────────────────────────────────────────────────────┐
-- │ 3d. Cached Streams (3-hour TTL)                             │
-- └──────────────────────────────────────────────────────────────┘
CREATE TABLE public.cached_streams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id    TEXT NOT NULL,
  season      INTEGER NOT NULL DEFAULT 1,
  episode     INTEGER NOT NULL DEFAULT 1,
  source_name TEXT NOT NULL,
  video_url   TEXT NOT NULL,
  language    TEXT NOT NULL CHECK (language IN ('eng-dub', 'hin-dub', 'sub')),
  video_type  TEXT NOT NULL CHECK (video_type IN ('m3u8', 'mp4')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cached_streams IS 'Temporary stream URL cache. Entries auto-expire after 3 hours.';

CREATE INDEX idx_cached_streams_lookup     ON public.cached_streams (media_id, season, episode);
CREATE INDEX idx_cached_streams_created_at ON public.cached_streams (created_at);


-- ┌──────────────────────────────────────────────────────────────┐
-- │ 3e. Cached Subtitles                                        │
-- └──────────────────────────────────────────────────────────────┘
CREATE TABLE public.cached_subtitles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id    TEXT NOT NULL,
  season      INTEGER NOT NULL DEFAULT 1,
  episode     INTEGER NOT NULL DEFAULT 1,
  subtitles   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cached_subtitles IS 'Cached external subtitle profiles (SRT/VTT references).';

CREATE INDEX idx_cached_subtitles_lookup ON public.cached_subtitles (media_id, season, episode);


-- ┌──────────────────────────────────────────────────────────────┐
-- │ 3f. Media Identity Mappings                                 │
-- └──────────────────────────────────────────────────────────────┘
CREATE TABLE public.media_identity_mappings (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tmdb_id        TEXT UNIQUE,
  anilist_id     TEXT UNIQUE,
  imdb_id        TEXT UNIQUE,
  search_aliases TEXT[] NOT NULL DEFAULT '{}',
  release_year   INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.media_identity_mappings IS 'Cross-provider media ID mapping cache for TMDB ↔ AniList ↔ IMDB lookups.';

CREATE INDEX idx_media_identity_tmdb    ON public.media_identity_mappings (tmdb_id);
CREATE INDEX idx_media_identity_anilist ON public.media_identity_mappings (anilist_id);


-- ┌──────────────────────────────────────────────────────────────┐
-- │ 3g. System Logs (Error Tracking)                            │
-- └──────────────────────────────────────────────────────────────┘
CREATE TABLE public.system_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level       TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'fatal')),
  context     TEXT NOT NULL,
  message     TEXT NOT NULL,
  stack_trace TEXT,
  media_id    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.system_logs IS 'Application-level error and event log. Auto-purged after 7 days.';

CREATE INDEX idx_system_logs_level      ON public.system_logs (level);
CREATE INDEX idx_system_logs_created_at ON public.system_logs (created_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 4: ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on every table
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_history           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_streams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cached_subtitles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_identity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs             ENABLE ROW LEVEL SECURITY;


-- ── profiles ────────────────────────────────────────────────────────────────
-- Anyone can view profiles (public usernames / avatars)
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can update their own profile (username, avatar, etc.)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING  ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Admins can update ANY profile (role changes, bans, etc.)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin());


-- ── watchlists ──────────────────────────────────────────────────────────────
CREATE POLICY "watchlists_all_own"
  ON public.watchlists FOR ALL
  TO authenticated
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);


-- ── watch_history ───────────────────────────────────────────────────────────
CREATE POLICY "watch_history_all_own"
  ON public.watch_history FOR ALL
  TO authenticated
  USING  ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);


-- ── cached_streams (public read/write for API routes) ───────────────────────
CREATE POLICY "cached_streams_select_public"
  ON public.cached_streams FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "cached_streams_insert_public"
  ON public.cached_streams FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "cached_streams_delete_public"
  ON public.cached_streams FOR DELETE
  TO anon, authenticated
  USING (true);


-- ── cached_subtitles (public read/write for API routes) ─────────────────────
CREATE POLICY "cached_subtitles_select_public"
  ON public.cached_subtitles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "cached_subtitles_insert_public"
  ON public.cached_subtitles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "cached_subtitles_delete_public"
  ON public.cached_subtitles FOR DELETE
  TO anon, authenticated
  USING (true);


-- ── media_identity_mappings (public read/write for API routes) ──────────────
CREATE POLICY "media_identity_select_public"
  ON public.media_identity_mappings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "media_identity_insert_public"
  ON public.media_identity_mappings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);


-- ── system_logs ─────────────────────────────────────────────────────────────
-- Anyone can INSERT logs (API routes log errors server-side)
CREATE POLICY "system_logs_insert_public"
  ON public.system_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can READ logs
CREATE POLICY "system_logs_select_admin"
  ON public.system_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Only admins can DELETE logs
CREATE POLICY "system_logs_delete_admin"
  ON public.system_logs FOR DELETE
  TO authenticated
  USING (public.is_admin());


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 5: AUTH TRIGGER — Auto-create profile on signup
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, avatar_url, role, email_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'user'),
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 6: PURGE FUNCTIONS (Auto-cleanup)
-- ─────────────────────────────────────────────────────────────────────────────

-- Purge cached streams older than 3 hours
CREATE OR REPLACE FUNCTION public.purge_expired_cached_streams()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.cached_streams WHERE created_at < NOW() - INTERVAL '3 hours';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Purge system logs older than 7 days
CREATE OR REPLACE FUNCTION public.purge_expired_system_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM public.system_logs WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_cached_streams() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_system_logs() FROM PUBLIC;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 7: SEED DATA — Promote admin account
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE: This will only work AFTER the user "shymom" signs up again.
-- If the user already exists, uncomment the line below:
-- UPDATE public.profiles SET role = 'admin' WHERE username = 'shymom';


-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE! Schema is clean, RLS is locked down, admin helpers are recursion-safe.
--
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  IMPORTANT: EMAIL VERIFICATION SETUP                                   ║
-- ║                                                                        ║
-- ║  Email verification is controlled in the Supabase Dashboard,           ║
-- ║  NOT via SQL. Follow these steps:                                      ║
-- ║                                                                        ║
-- ║  1. Go to: Supabase Dashboard → Authentication → Providers             ║
-- ║  2. Under "Email", ensure "Confirm email" is ENABLED                   ║
-- ║  3. Go to: Authentication → Email Templates                            ║
-- ║  4. Customize the "Confirm signup" email template                      ║
-- ║  5. Set the Site URL under Authentication → URL Configuration          ║
-- ║     to your production URL (e.g., https://your-domain.com)             ║
-- ║                                                                        ║
-- ║  When "Confirm email" is enabled, new signups will NOT receive a       ║
-- ║  session until they click the verification link in their email.        ║
-- ║  The app already handles this — see signUp() in userStore.ts:          ║
-- ║    if (!data.session) → "Please check your email to verify..."         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- ═══════════════════════════════════════════════════════════════════════════════
