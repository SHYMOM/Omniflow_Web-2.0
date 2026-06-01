import { supabase } from '@/lib/supabase';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function expandQuery(
  mediaId: string, 
  type: 'anime' | 'movie' | 'tv' | 'kdrama',
  season: number = 1
): Promise<{ queries: string[], primaryTitle: string, releaseYear?: number, tmdbId?: string }> {
  // 1. Check database for existing mappings
  const { data: existingMap } = await supabase
    .from('media_identity_mappings')
    .select('*')
    .or(`tmdb_id.eq.${mediaId},anilist_id.eq.${mediaId},imdb_id.eq.${mediaId}`)
    .maybeSingle();

  if (existingMap && existingMap.search_aliases && existingMap.search_aliases.length > 0) {
    return {
      queries: buildMatrix(existingMap.search_aliases, type, season),
      primaryTitle: existingMap.search_aliases[0],
      releaseYear: existingMap.release_year || undefined,
      tmdbId: existingMap.tmdb_id || undefined
    };
  }

  // 2. Cache Miss - Fetch from external APIs
  const aliases = new Set<string>();
  let primaryTitle = '';
  let releaseYear: number | undefined;
  let tmdbId = mediaId.includes('tmdb') ? mediaId.replace('tmdb-movie-', '').replace('tmdb-tv-', '') : undefined;

  if (type === 'anime') {
    // Fetch from AniList
    const anilistId = mediaId.replace('anilist-', '').replace('mal-', '');
    const query = `
      query ($id: Int) {
        Media (id: $id, type: ANIME) {
          title { romaji english native }
          synonyms
          seasonYear
        }
      }
    `;
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { id: parseInt(anilistId) } })
      });
      const data = await res.json();
      const media = data?.data?.Media;
      if (media) {
        if (media.title.english) { aliases.add(media.title.english); primaryTitle = media.title.english; }
        if (media.title.romaji) { aliases.add(media.title.romaji); if (!primaryTitle) primaryTitle = media.title.romaji; }
        if (media.title.native) aliases.add(media.title.native);
        media.synonyms?.forEach((s: string) => aliases.add(s));
        releaseYear = media.seasonYear;
      }
    } catch (e) {
      console.warn('Failed to fetch from AniList', e);
    }
  } else {
    // Fetch from TMDB
    const endpointType = type === 'movie' ? 'movie' : 'tv';
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${endpointType}/${tmdbId}?append_to_response=alternative_titles,translations&api_key=${TMDB_API_KEY}`);
      const data = await res.json();
      
      if (data.title || data.name) {
        primaryTitle = data.title || data.name;
        aliases.add(primaryTitle);
      }
      if (data.release_date || data.first_air_date) {
        releaseYear = parseInt((data.release_date || data.first_air_date).substring(0, 4));
      }
      
      // Alternative titles
      const altTitles = type === 'movie' ? data.alternative_titles?.titles : data.alternative_titles?.results;
      altTitles?.forEach((alt: any) => aliases.add(alt.title));

      // Hindi translation explicitly
      const translations = data.translations?.translations;
      const hindiTrans = translations?.find((t: any) => t.iso_639_1 === 'hi');
      if (hindiTrans?.data?.title || hindiTrans?.data?.name) {
        aliases.add(hindiTrans.data.title || hindiTrans.data.name);
      }
    } catch (e) {
      console.warn('Failed to fetch from TMDB', e);
    }
  }

  const searchAliases = Array.from(aliases).filter(Boolean);
  if (!primaryTitle && searchAliases.length > 0) {
    primaryTitle = searchAliases[0];
  }

  // 3. Save to Supabase
  if (primaryTitle) {
    const payload: any = {
      search_aliases: searchAliases,
      release_year: releaseYear
    };
    
    if (mediaId.includes('tmdb')) payload.tmdb_id = mediaId;
    if (mediaId.includes('anilist') || mediaId.includes('mal')) payload.anilist_id = mediaId;

    await supabase.from('media_identity_mappings').insert(payload).select().maybeSingle();
  }

  return {
    queries: buildMatrix(searchAliases, type, season),
    primaryTitle: primaryTitle || mediaId,
    releaseYear,
    tmdbId
  };
}

function buildMatrix(aliases: string[], type: 'anime' | 'movie' | 'tv' | 'kdrama', season: number): string[] {
  const queries = new Set<string>();
  
  aliases.forEach(alias => {
    // Base
    queries.add(alias);
    
    // Dub targeting
    queries.add(`${alias} Dub`);
    queries.add(`${alias} Dual Audio`);
    queries.add(`${alias} Hindi`);
    queries.add(`${alias} Hindi Dubbed`);

    // TV / Anime specifics
    if (type === 'tv' || type === 'kdrama' || type === 'anime') {
      queries.add(`${alias} Season ${season}`);
      queries.add(`${alias} S${season.toString().padStart(2, '0')}`);
    }
  });

  return Array.from(queries);
}
