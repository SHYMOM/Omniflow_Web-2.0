-- Migration to add targeted media ads
-- Uses public.is_admin() SECURITY DEFINER helper to avoid RLS recursion

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

-- Enable RLS
ALTER TABLE public.media_ads ENABLE ROW LEVEL SECURITY;

-- Policies — use is_admin() to prevent RLS recursion on profiles table
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

-- Global settings table for admin toggles (ads on/off, etc.)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings_select_public"
    ON public.system_settings FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "system_settings_manage_admin"
    ON public.system_settings FOR ALL
    TO authenticated
    USING (public.is_admin());

-- Insert default global ads toggle
INSERT INTO public.system_settings (key, value)
VALUES ('global_ads_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
