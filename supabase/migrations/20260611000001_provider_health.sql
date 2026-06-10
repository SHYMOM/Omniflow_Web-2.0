-- Migration to create provider_health table
CREATE TABLE IF NOT EXISTS public.provider_health (
    provider_name TEXT PRIMARY KEY,
    is_alive BOOLEAN DEFAULT TRUE,
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    avg_response_ms INTEGER DEFAULT 0,
    circuit_open BOOLEAN DEFAULT FALSE,
    consecutive_failures INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.provider_health ENABLE ROW LEVEL SECURITY;

-- Select policy: public read
CREATE POLICY "provider_health_select_public" 
    ON public.provider_health FOR SELECT 
    TO anon, authenticated 
    USING (true);

-- Insert/Update/Delete policies: public read/write for scraper runners
CREATE POLICY "provider_health_all_public" 
    ON public.provider_health FOR ALL 
    TO anon, authenticated 
    USING (true)
    WITH CHECK (true);
