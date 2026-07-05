import { supabase } from '@/lib/supabase';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response | null> {
  const { timeout = 4000, ...fetchOptions } = options;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch {
    return null;
  }
}

export async function expandQuery(
  mediaId: string,
  type: 'anime' | 'movie' | 'tv' | 'kdrama',
  season: number = 1
): Promise<{ queries: string[], primaryTitle: string, releaseYear?: number, tmdbId?: string, imdbId?: string, expectedDuration?: number }> {

  let parsedTmdbId: number | undefined;
  let parsedAnilistId: number | undefined;
  let parsedMalId: number | undefined;
  let parsedImdbId: string | undefined;
  let expectedDuration: number | undefined;

  // Parse prefix and extract ID value
  if (mediaId.startsWith('tmdb-movie-')) {
    parsedTmdbId = parseInt(mediaId.replace('tmdb-movie-', ''));
  } else if (mediaId.startsWith('tmdb-tv-')) {
    parsedTmdbId = parseInt(mediaId.replace('tmdb-tv-', ''));
  } else if (mediaId.startsWith('anilist-')) {
    parsedAnilistId = parseInt(mediaId.replace('anilist-', ''));
  } else if (mediaId.startsWith('mal-')) {
    parsedMalId = parseInt(mediaId.replace('mal-', ''));
  } else if (mediaId.startsWith('tt')) {
    parsedImdbId = mediaId;
  } else {
    const num = parseInt(mediaId);
    if (!isNaN(num)) {
      if (type === 'anime') {
        parsedAnilistId = num;
      } else {
        parsedTmdbId = num;
      }
    } else if (mediaId.startsWith('tt')) {
      parsedImdbId = mediaId;
    }
  }

  // Fast path: derive basic title from ID immediately so scraping can start.
  let primaryTitle = mediaId.replace(/^(tmdb-movie-|tmdb-tv-|anilist-|mal-|jikan-)/, '');
  let releaseYear: number | undefined;
  let queries: string[] = [];

  // Run enrichment (Supabase lookup + external API) with a hard 3s timeout
  const enrichment: Promise<void> = (async () => {
    let existingMap: any = null;
    const conditions: string[] = [];
    if (parsedTmdbId) conditions.push(`tmdb_id.eq.${parsedTmdbId}`);
    if (parsedAnilistId) conditions.push(`anilist_id.eq.${parsedAnilistId}`);
    if (parsedMalId) conditions.push(`mal_id.eq.${parsedMalId}`);
    if (parsedImdbId) conditions.push(`imdb_id.eq.${parsedImdbId}`);

    // 1. Check media_id_map (1s timeout max)
    if (conditions.length > 0) {
      try {
        const { data } = await Promise.race([
          supabase.from('media_id_map').select('*').or(conditions.join(',')).maybeSingle(),
          new Promise<any>(r => setTimeout(() => r({ data: null }), 1000))
        ]);
        existingMap = data;
      } catch {
        // Continue without cached mapping
      }
    }

    const aliases = new Set<string>();

    if (existingMap) {
      if (existingMap.title_en) {
        primaryTitle = existingMap.title_en;
        aliases.add(existingMap.title_en);
      }
      if (existingMap.title_romaji) {
        if (!existingMap.title_en) primaryTitle = existingMap.title_romaji;
        aliases.add(existingMap.title_romaji);
      }
      if (existingMap.title_native) aliases.add(existingMap.title_native);

      if (existingMap.tmdb_id) parsedTmdbId = existingMap.tmdb_id;
      if (existingMap.imdb_id) parsedImdbId = existingMap.imdb_id;
      if (existingMap.mal_id) parsedMalId = existingMap.mal_id;
      if (existingMap.anilist_id) parsedAnilistId = existingMap.anilist_id;
    }

    // 2. Fetch from external APIs (3s timeout each)
    if (type === 'anime') {
      const targetAnilistId = parsedAnilistId || parsedMalId;
      if (targetAnilistId) {
        const query = `
          query ($id: Int) {
            Media (id: $id, type: ANIME) {
              title { romaji english native }
              synonyms
              seasonYear
              duration
            }
          }
        `;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { id: targetAnilistId } }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res?.ok) {
            const data = await res.json();
            const media = data?.data?.Media;
            if (media) {
              if (media.title.english) { aliases.add(media.title.english); primaryTitle = media.title.english; }
              if (media.title.romaji) { aliases.add(media.title.romaji); if (!primaryTitle) primaryTitle = media.title.romaji; }
              if (media.title.native) aliases.add(media.title.native);
              media.synonyms?.forEach((s: string) => aliases.add(s));
              releaseYear = media.seasonYear;
              if (media.duration) expectedDuration = media.duration;
            }
          }
        } catch {
          // Timeout — continue with default title
        }
      }
    } else if (parsedTmdbId) {
      const endpointType = type === 'movie' ? 'movie' : 'tv';
      try {
        const res = await fetchWithTimeout(
          `https://api.themoviedb.org/3/${endpointType}/${parsedTmdbId}?append_to_response=alternative_titles,translations,external_ids&api_key=${TMDB_API_KEY}`,
          { timeout: 3000 }
        );
        const data = res?.ok ? await res.json() : null;
        if (data) {
          if (data.title || data.name) {
            primaryTitle = data.title || data.name;
            aliases.add(primaryTitle);
          }
          if (data.release_date || data.first_air_date) {
            releaseYear = parseInt((data.release_date || data.first_air_date).substring(0, 4));
          }
          parsedImdbId = data.imdb_id || data.external_ids?.imdb_id || parsedImdbId;
          const altTitles = type === 'movie' ? data.alternative_titles?.titles : data.alternative_titles?.results;
          altTitles?.forEach((alt: any) => aliases.add(alt.title));
          const translations = data.translations?.translations;
          const hindiTrans = translations?.find((t: any) => t.iso_639_1 === 'hi');
          if (hindiTrans?.data?.title || hindiTrans?.data?.name) {
            aliases.add(hindiTrans.data.title || hindiTrans.data.name);
          }
          if (type === 'movie') {
            if (data.runtime) expectedDuration = data.runtime;
          } else if (data.episode_run_time && data.episode_run_time.length > 0) {
            expectedDuration = data.episode_run_time[0];
          }
        }
      } catch {
        // Timeout — continue
      }
    }

    const searchAliases = Array.from(aliases).filter(Boolean);
    if (!primaryTitle && searchAliases.length > 0) {
      primaryTitle = searchAliases[0];
    }

    queries = buildMatrix(searchAliases, type, season);

    // 3. Upsert to Supabase (fire-and-forget, don't block)
    if (primaryTitle && (parsedTmdbId || parsedAnilistId || parsedMalId || parsedImdbId)) {
      try {
        const payload: any = {
          title_en: primaryTitle,
          title_romaji: existingMap?.title_romaji || (type === 'anime' ? primaryTitle : undefined),
          title_native: existingMap?.title_native || undefined,
          mapping_confidence: 1.0,
          mapping_source: 'query-expander'
        };
        if (parsedTmdbId) payload.tmdb_id = parsedTmdbId;
        if (parsedAnilistId) payload.anilist_id = parsedAnilistId;
        if (parsedMalId) payload.mal_id = parsedMalId;
        if (parsedImdbId) payload.imdb_id = parsedImdbId;
        if (type) payload.media_type = type;

        const conflictCol = parsedTmdbId ? 'tmdb_id' : parsedAnilistId ? 'anilist_id' : parsedImdbId ? 'imdb_id' : 'mal_id';
        if (conflictCol) {
          await supabase.from('media_id_map').upsert(payload, { onConflict: conflictCol, ignoreDuplicates: false });
        }
      } catch {
        // Fire-and-forget
      }
    }
  })();

  // Wait for enrichment with 3s timeout
  await Promise.race([
    enrichment,
    new Promise<void>(resolve => setTimeout(() => {
      if (!primaryTitle) primaryTitle = mediaId.replace(/^(tmdb-movie-|tmdb-tv-|anilist-|mal-|jikan-)/, '');
      resolve();
    }, 3000))
  ]);

  // Build fallback queries even if enrichment timed out
  if (queries.length === 0) {
    queries = buildMatrix([primaryTitle || mediaId], type, season);
  }

  return {
    queries,
    primaryTitle: primaryTitle || mediaId,
    releaseYear,
    tmdbId: parsedTmdbId ? String(parsedTmdbId) : undefined,
    imdbId: parsedImdbId,
    expectedDuration
  };
}

function buildMatrix(aliases: string[], type: 'anime' | 'movie' | 'tv' | 'kdrama', season: number): string[] {
  const queries = new Set<string>();

  aliases.forEach(alias => {
    queries.add(alias);

    // Dub / Language targeting variations
    queries.add(`${alias} Dub`);
    queries.add(`${alias} Dual Audio`);
    queries.add(`${alias} Hindi`);
    queries.add(`${alias} Hindi Dubbed`);

    if (type === 'tv' || type === 'kdrama' || type === 'anime') {
      queries.add(`${alias} Season ${season}`);
      queries.add(`${alias} S${season.toString().padStart(2, '0')}`);
    }
  });

  return Array.from(queries);
}
