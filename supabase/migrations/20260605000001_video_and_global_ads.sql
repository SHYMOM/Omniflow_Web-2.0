-- Migration to add support for global ads and video ads
-- Alter media_id and media_type to be nullable to support global ads
ALTER TABLE public.media_ads ALTER COLUMN media_id DROP NOT NULL;
ALTER TABLE public.media_ads ALTER COLUMN media_type DROP NOT NULL;

-- Add video_url and is_global columns
ALTER TABLE public.media_ads ADD COLUMN IF NOT EXISTS video_url TEXT NULL;
ALTER TABLE public.media_ads ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false NOT NULL;
