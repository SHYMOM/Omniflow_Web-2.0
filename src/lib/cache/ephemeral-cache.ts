import { supabase } from '@/lib/supabase';

interface StreamSource {
  language: string;
  url: string;
  type: 'm3u8' | 'mp4';
}

interface SubtitleSource {
  language: string;
  url: string;
  label: string;
}

interface StreamPayload {
  video_sources: StreamSource[];
  subtitle_sources: SubtitleSource[];
}

/**
 * Ephemeral Cache for storing the strictly mapped StreamPayload.
 * The TTL validation forces a fresh scrape if the cache is older than 120 minutes.
 */
export class EphemeralCache {
  private static readonly TTL_MS = 120 * 60 * 1000; // 120 minutes

  /**
   * Retrieves the stream payload from the database if it is within the TTL.
   */
  static async get(mediaId: string, episodeKey: string): Promise<StreamPayload | null> {
    try {
      const { data, error } = await supabase
        .from('ephemeral_streams')
        .select('stream_payload, created_at')
        .eq('media_id', mediaId)
        .eq('episode_key', episodeKey)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const createdAt = new Date(data.created_at).getTime();
      const now = Date.now();

      // Check TTL (120 minutes)
      if (now - createdAt > this.TTL_MS) {
        console.log(`[EphemeralCache] Cache expired for ${mediaId} ${episodeKey}`);
        return null; // Expired, bypass cache
      }

      console.log(`[EphemeralCache] Cache hit for ${mediaId} ${episodeKey}`);
      return data.stream_payload as StreamPayload;
    } catch (err) {
      console.warn(`[EphemeralCache] Error fetching from cache:`, err);
      return null;
    }
  }

  /**
   * Upserts the stream payload into the database, overwriting if it exists.
   */
  static async set(mediaId: string, episodeKey: string, payload: StreamPayload): Promise<void> {
    try {
      // Upsert based on the unique index on (media_id, episode_key)
      const { error } = await supabase
        .from('ephemeral_streams')
        .upsert({
          media_id: mediaId,
          episode_key: episodeKey,
          stream_payload: payload,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'media_id, episode_key'
        });

      if (error) {
        console.error(`[EphemeralCache] Failed to set cache for ${mediaId} ${episodeKey}:`, error);
      } else {
        console.log(`[EphemeralCache] Cached payload for ${mediaId} ${episodeKey}`);
      }
    } catch (err) {
      console.error(`[EphemeralCache] Error setting cache:`, err);
    }
  }
}
