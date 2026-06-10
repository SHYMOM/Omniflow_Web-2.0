import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

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
}
