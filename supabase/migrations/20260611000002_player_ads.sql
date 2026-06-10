-- File: supabase/migrations/20260611000002_player_ads.sql
CREATE TABLE IF NOT EXISTS public.player_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('image', 'video')) NOT NULL,
  src TEXT NOT NULL,               -- CDN URL of ad creative
  click_url TEXT,                  -- Where clicking the ad goes
  duration_seconds INTEGER NOT NULL DEFAULT 30,
  skip_after_seconds INTEGER NOT NULL DEFAULT 5,
  placement TEXT CHECK (placement IN ('pre_roll', 'post_roll')) DEFAULT 'pre_roll',
  is_active BOOLEAN DEFAULT TRUE,
  weight INTEGER DEFAULT 1,        -- Higher weight = shown more often
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.player_ads ENABLE ROW LEVEL SECURITY;

-- Select policy: public read
CREATE POLICY "player_ads_select_public" 
    ON public.player_ads FOR SELECT 
    TO anon, authenticated 
    USING (is_active = true);

-- Insert/Update policies: admin only
CREATE POLICY "player_ads_insert_admin" 
    ON public.player_ads FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "player_ads_update_admin" 
    ON public.player_ads FOR UPDATE 
    TO authenticated 
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
    WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "player_ads_delete_admin" 
    ON public.player_ads FOR DELETE 
    TO authenticated 
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- RPC for incrementing ad impressions
CREATE OR REPLACE FUNCTION increment_ad_impression(ad_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.player_ads
  SET impressions = impressions + 1
  WHERE id = ad_id;
END;
$$;

-- RPC for incrementing ad clicks
CREATE OR REPLACE FUNCTION increment_ad_click(ad_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.player_ads
  SET clicks = clicks + 1
  WHERE id = ad_id;
END;
$$;
