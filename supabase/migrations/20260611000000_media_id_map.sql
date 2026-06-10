-- Migration to create media_id_map table
CREATE TABLE IF NOT EXISTS public.media_id_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tmdb_id INTEGER UNIQUE,
    imdb_id TEXT UNIQUE,
    mal_id INTEGER UNIQUE,
    anilist_id INTEGER UNIQUE,
    anidb_id INTEGER,
    kitsu_id TEXT,
    tvdb_id INTEGER,
    mangadex_id UUID,
    comick_id TEXT,
    media_type TEXT CHECK (media_type IN ('anime','movie','tv','manga','novel','donghua','drama')),
    title_en TEXT,
    title_romaji TEXT,
    title_native TEXT,
    mapping_confidence FLOAT DEFAULT 0.0,
    mapping_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.media_id_map ENABLE ROW LEVEL SECURITY;

-- Select policy: public read
CREATE POLICY "media_id_map_select_public" 
    ON public.media_id_map FOR SELECT 
    TO anon, authenticated 
    USING (true);

-- Insert/Update policies: public write for API sync jobs
CREATE POLICY "media_id_map_insert_public" 
    ON public.media_id_map FOR INSERT 
    TO anon, authenticated 
    WITH CHECK (true);

CREATE POLICY "media_id_map_update_public" 
    ON public.media_id_map FOR UPDATE 
    TO anon, authenticated 
    USING (true)
    WITH CHECK (true);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_media_id_map_tmdb ON public.media_id_map(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_id_map_anilist ON public.media_id_map(anilist_id);
CREATE INDEX IF NOT EXISTS idx_media_id_map_mal ON public.media_id_map(mal_id);
CREATE INDEX IF NOT EXISTS idx_media_id_map_imdb ON public.media_id_map(imdb_id);
CREATE INDEX IF NOT EXISTS idx_media_id_map_mangadex ON public.media_id_map(mangadex_id);
