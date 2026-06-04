import { supabase } from '@/lib/supabase';

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface CachedVideoUrl {
  lang: string;
  url: string;
  type: 'm3u8' | 'mp4';
  referer: string;
  source_name: string;
}

export interface CachedSubtitleUrl {
  lang: string;
  label: string;
  url: string;
}

interface EphemeralRow {
  media_id: string;
  media_type: string;
  season: number;
  episode: number;
  video_urls: CachedVideoUrl[];
  subtitle_urls: CachedSubtitleUrl[];
  created_at: string;
}

/**
 * Check Supabase for cached stream URLs.
 * Returns null if cache is missing or older than 2 hours.
 */
export async function getCachedLinks(
  mediaId: string,
  mediaType: string,
  season: number,
  episode: number
): Promise<{ videoUrls: CachedVideoUrl[]; subtitleUrls: CachedSubtitleUrl[] } | null> {
  try {
    const { data, error } = await supabase
      .from('ephemeral_links')
      .select('video_urls, subtitle_urls, created_at')
      .eq('media_id', mediaId)
      .eq('media_type', mediaType)
      .eq('season', season)
      .eq('episode', episode)
      .maybeSingle();

    if (error || !data) return null;

    // TTL check: if created_at is older than 2 hours, treat as stale
    const createdAt = new Date(data.created_at).getTime();
    const now = Date.now();
    if (now - createdAt > TTL_MS) {
      // Delete stale row in the background — don't await
      supabase
        .from('ephemeral_links')
        .delete()
        .eq('media_id', mediaId)
        .eq('media_type', mediaType)
        .eq('season', season)
        .eq('episode', episode)
        .then(() => {});
      return null;
    }

    const videoUrls = (data.video_urls || []) as CachedVideoUrl[];
    const subtitleUrls = (data.subtitle_urls || []) as CachedSubtitleUrl[];

    if (videoUrls.length === 0) return null;

    return { videoUrls, subtitleUrls };
  } catch (err) {
    console.warn('[SupabaseCache] getCachedLinks error:', err);
    return null;
  }
}

/**
 * Upsert stream URLs into Supabase ephemeral cache.
 */
export async function setCachedLinks(
  mediaId: string,
  mediaType: string,
  season: number,
  episode: number,
  videoUrls: CachedVideoUrl[],
  subtitleUrls: CachedSubtitleUrl[]
): Promise<void> {
  try {
    const { error } = await supabase
      .from('ephemeral_links')
      .upsert(
        {
          media_id: mediaId,
          media_type: mediaType,
          season,
          episode,
          video_urls: videoUrls,
          subtitle_urls: subtitleUrls,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'media_id,media_type,season,episode' }
      );

    if (error) {
      console.warn('[SupabaseCache] setCachedLinks error:', error.message);
    }
  } catch (err) {
    console.warn('[SupabaseCache] setCachedLinks exception:', err);
  }
}
