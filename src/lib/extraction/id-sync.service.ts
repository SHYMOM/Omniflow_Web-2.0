import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Request-scoped cache for ARM ID lookups — avoids redundant API calls
 * within the same request chain. Keyed by `source:id`.
 */
const armCache = new Map<string, { tmdbId: string | null; imdbId: string | null }>();

export class IdSyncService {
  /**
   * Syncs AniList, MAL, TMDB, TVDB IDs from Fribb's anime-list-full.json
   */
  static async syncAnimeIds() {
    try {
      console.log('[IdSyncService] Fetching Fribb anime-list-full.json...');
      const response = await fetch('https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json');
      if (!response.ok) throw new Error('Failed to fetch Fribb list');
      
      const data = await response.json();
      console.log(`[IdSyncService] Fetched ${data.length} records. Processing...`);

      // We'll process in chunks of 500 to not overwhelm Supabase
      const chunkSize = 500;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        
        const upsertData = chunk.map((item: any) => ({
          anilist_id: item.anilist_id || null,
          mal_id: item.mal_id || null,
          anidb_id: item.anidb_id || null,
          tmdb_id: item.tmdb_show_id || item.tmdb_movie_id || null,
          tvdb_id: item.thetvdb_id || null,
          imdb_id: item.imdb_id || null,
          media_type: item.type === 'Movie' ? 'movie' : 'anime',
          mapping_confidence: 1.0,
          mapping_source: 'fribb_dump'
        })).filter((item: any) => item.anilist_id || item.mal_id); // Must have at least one ID

        if (upsertData.length > 0) {
          const { error } = await supabase
            .from('media_id_map')
            .upsert(upsertData, { onConflict: 'anilist_id', ignoreDuplicates: true });
          
          if (error) {
            console.error('[IdSyncService] Chunk upsert error:', error.message);
          }
        }
      }

      console.log('[IdSyncService] Fribb sync complete!');
    } catch (err) {
      console.error('[IdSyncService] Fribb sync failed:', err);
    }
  }

  /**
   * Fill missing cross-IDs from Supabase cache based on partial IDs
   */
  static async resolveAllIds(partialIds: { anilistId?: number, malId?: number, tmdbId?: number, imdbId?: string }): Promise<any> {
    if (!partialIds.anilistId && !partialIds.malId && !partialIds.tmdbId && !partialIds.imdbId) {
      return partialIds; // Nothing to search with
    }

    try {
      let query = supabase.from('media_id_map').select('*');
      
      if (partialIds.anilistId) query = query.eq('anilist_id', partialIds.anilistId);
      else if (partialIds.malId) query = query.eq('mal_id', partialIds.malId);
      else if (partialIds.tmdbId) query = query.eq('tmdb_id', partialIds.tmdbId);
      else if (partialIds.imdbId) query = query.eq('imdb_id', partialIds.imdbId);

      const { data, error } = await query.maybeSingle();

      if (error || !data) return partialIds;

      return {
        anilistId: data.anilist_id || partialIds.anilistId,
        malId: data.mal_id || partialIds.malId,
        tmdbId: data.tmdb_id || partialIds.tmdbId,
        imdbId: data.imdb_id || partialIds.imdbId,
        tvdbId: data.tvdb_id,
        anidbId: data.anidb_id,
        titleEn: data.title_en,
        titleRomaji: data.title_romaji,
        titleNative: data.title_native
      };
    } catch (err) {
      console.error('[IdSyncService] Resolve IDs error:', err);
      return partialIds;
    }
  }

  /**
   * Resolve TMDB ID for anime from a source-specific ID (AniList, MAL).
   * Checks in-memory cache → Supabase media_id_map → ARM API.
   * Centralizes the 4 separate ARM calls scattered across the codebase.
   */
  static async resolveTmdbId(animeId: string, source: 'anilist' | 'myanimelist' | 'jikan' = 'anilist'): Promise<{ tmdbId: string | null; imdbId: string | null }> {
    const cleanId = animeId.replace('anilist-', '').replace('mal-', '').replace('jikan-', '');
    const actualSource = source === 'jikan' ? 'myanimelist' : source;
    const cacheKey = `${actualSource}:${cleanId}`;

    // 1. Check in-memory request-scoped cache
    const cached = armCache.get(cacheKey);
    if (cached) return cached;

    // 2. Check Supabase media_id_map
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 2000);
      const query = source === 'myanimelist' || source === 'jikan'
        ? supabase.from('media_id_map').select('tmdb_id, imdb_id').eq('mal_id', Number(cleanId))
        : supabase.from('media_id_map').select('tmdb_id, imdb_id').eq('anilist_id', Number(cleanId));
      const { data } = await query.maybeSingle();
      clearTimeout(timeout2);
      if (data && (data.tmdb_id || data.imdb_id)) {
        const result = { tmdbId: data.tmdb_id ? String(data.tmdb_id) : null, imdbId: data.imdb_id || null };
        armCache.set(cacheKey, result);
        return result;
      }
    } catch { /* fall through to ARM API */ }

    // 3. ARM API — 3s total timeout, 1 retry with 500ms delay
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://arm.haglund.dev/api/v2/ids?source=${actualSource}&id=${cleanId}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const result = {
            tmdbId: data.themoviedb ? String(data.themoviedb) : null,
            imdbId: data.imdb || null,
          };
          armCache.set(cacheKey, result);
          return result;
        }
      } catch {
        if (attempt === 0) await new Promise(r => setTimeout(r, 500));
      }
    }

    const result = { tmdbId: null, imdbId: null };
    armCache.set(cacheKey, result);
    return result;
  }
}
