-- ═══════════════════════════════════════════════════════════════
-- OMNIFLOW DATABASE MIGRATION - COMPLETE SCHEMA SETUP
-- Includes: Caching, Core Services, Auth Profiles, Watchlists, History
-- ═══════════════════════════════════════════════════════════════

-- 1. Create Media Identity Mappings Table (Caching)
CREATE TABLE IF NOT EXISTS public.media_identity_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tmdb_id TEXT UNIQUE,
    anilist_id TEXT UNIQUE,
    imdb_id TEXT UNIQUE,
    search_aliases TEXT[] NOT NULL DEFAULT '{}',
    release_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_identity_tmdb ON public.media_identity_mappings(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_identity_anilist ON public.media_identity_mappings(anilist_id);

ALTER TABLE public.media_identity_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to media_identity_mappings" 
    ON public.media_identity_mappings 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Allow public insert to media_identity_mappings" 
    ON public.media_identity_mappings 
    FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);


-- 2. Create Cached Streams Table (with 3-Hour TTL)
CREATE TABLE IF NOT EXISTS public.cached_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id TEXT NOT NULL,
    season INTEGER NOT NULL DEFAULT 1,
    episode INTEGER NOT NULL DEFAULT 1,
    source_name TEXT NOT NULL,
    video_url TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('eng-dub', 'hin-dub', 'sub')),
    video_type TEXT NOT NULL CHECK (video_type IN ('m3u8', 'mp4')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cached_streams_lookup ON public.cached_streams(media_id, season, episode);
CREATE INDEX IF NOT EXISTS idx_cached_streams_created_at ON public.cached_streams(created_at);

ALTER TABLE public.cached_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cached_streams" 
    ON public.cached_streams 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Allow public insert to cached_streams" 
    ON public.cached_streams 
    FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow public delete to cached_streams" 
    ON public.cached_streams 
    FOR DELETE 
    TO anon, authenticated 
    USING (true);


-- 3. Create Cached Subtitles Table
CREATE TABLE IF NOT EXISTS public.cached_subtitles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id TEXT NOT NULL,
    season INTEGER NOT NULL DEFAULT 1,
    episode INTEGER NOT NULL DEFAULT 1,
    subtitles JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cached_subtitles_lookup ON public.cached_subtitles(media_id, season, episode);

ALTER TABLE public.cached_subtitles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to cached_subtitles" 
    ON public.cached_subtitles 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Allow public insert to cached_subtitles" 
    ON public.cached_subtitles 
    FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow public delete to cached_subtitles" 
    ON public.cached_subtitles 
    FOR DELETE 
    TO anon, authenticated 
    USING (true);


-- ═══════════════════════════════════════════════════════════════
-- USER AUTHENTICATION & DATA (Profiles, Watchlist, History)
-- ═══════════════════════════════════════════════════════════════

-- 4. User Profiles (Syncs with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." 
    ON public.profiles 
    FOR SELECT 
    TO anon, authenticated 
    USING (true);

CREATE POLICY "Users can update own profile." 
    ON public.profiles 
    FOR UPDATE 
    TO authenticated 
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);


-- 5. Watchlist (Saved Media)
CREATE TABLE IF NOT EXISTS public.watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('anime', 'movie', 'tv', 'kdrama')),
    title TEXT NOT NULL,
    poster_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON public.watchlists(user_id);

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own watchlist" 
    ON public.watchlists 
    FOR ALL 
    TO authenticated 
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);


-- 6. Watch History (Continue Watching)
CREATE TABLE IF NOT EXISTS public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('anime', 'movie', 'tv', 'kdrama')),
    title TEXT NOT NULL,
    poster_url TEXT,
    season INTEGER DEFAULT 1,
    episode INTEGER DEFAULT 1,
    progress INTEGER DEFAULT 0, -- Time in seconds
    duration INTEGER DEFAULT 0, -- Total duration in seconds
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON public.watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_updated_at ON public.watch_history(updated_at DESC);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own history" 
    ON public.watch_history 
    FOR ALL 
    TO authenticated 
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);


-- ═══════════════════════════════════════════════════════════════
-- SYSTEM LOGS (Error Tracking)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'fatal')),
    context TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    media_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert to system_logs" 
    ON public.system_logs 
    FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════
-- PURGE FUNCTIONS (Auto cleanup of cache and logs)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.purge_expired_cached_streams()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM public.cached_streams WHERE created_at < NOW() - INTERVAL '3 hours';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.purge_expired_system_logs()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
    DELETE FROM public.system_logs WHERE created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════
-- SECURITY RESTRICTIONS (Revoking public execution on functions)
-- ═══════════════════════════════════════════════════════════════
-- Revoke default public execution privileges to secure internal functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_cached_streams() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_expired_system_logs() FROM PUBLIC;
