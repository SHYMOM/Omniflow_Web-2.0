import { memoryCache } from '@/lib/cache/memory';

export interface ExternalSubtitle {
  lang: string; // ISO 639-1 code (e.g. 'en', 'hi')
  label: string; // Human-readable name (e.g. 'English', 'Hindi')
  url: string;
}

/**
 * Fetch subtitles from an external REST API (e.g., OpenSubtitles API or TMDB-based subtitle scrapers).
 * Mapped by language code.
 */
export async function fetchExternalSubtitles(
  tmdbId: string | number,
  type: 'movie' | 'tv' | 'anime' = 'movie',
  season?: number,
  episode?: number
): Promise<ExternalSubtitle[]> {
  const cacheKey = `subtitles:${type}:${tmdbId}:${season}:${episode}`;
  const cached = memoryCache.get<ExternalSubtitle[]>(cacheKey);
  if (cached) return cached;

  try {
    const apiKey = process.env.TMDB_API_KEY;
    console.log(`[Subtitles] Fetching for TMDB ID: ${tmdbId}, Type: ${type}, TMDB_API_KEY exists: ${!!apiKey}`);
    if (!apiKey) {
      console.warn('[Subtitles] TMDB_API_KEY is missing');
      return [];
    }

    let imdbId = '';
    if (type === 'anime') {
      const tvUrl = `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${apiKey}`;
      const tvRes = await fetch(tvUrl);
      if (tvRes.ok) {
        const tvData = await tvRes.json();
        imdbId = tvData.imdb_id;
      } else {
        const movieUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/external_ids?api_key=${apiKey}`;
        const movieRes = await fetch(movieUrl);
        if (movieRes.ok) {
          const movieData = await movieRes.json();
          imdbId = movieData.imdb_id;
        }
      }
    } else {
      const tmdbType = type === 'movie' ? 'movie' : 'tv';
      const tmdbUrl = `https://api.themoviedb.org/3/${tmdbType}/${tmdbId}/external_ids?api_key=${apiKey}`;
      const tmdbRes = await fetch(tmdbUrl);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        imdbId = tmdbData.imdb_id;
      } else {
        console.warn(`[Subtitles] TMDB request failed with status: ${tmdbRes.status}`);
      }
    }

    console.log(`[Subtitles] Resolved IMDB ID: ${imdbId}`);
    if (!imdbId) return [];

    let stremioUrl = `https://opensubtitles-v3.strem.io/subtitles/movie/${imdbId}.json`;
    if ((type === 'tv' || type === 'anime') && season && episode) {
      stremioUrl = `https://opensubtitles-v3.strem.io/subtitles/series/${imdbId}:${season}:${episode}.json`;
    }

    console.log(`[Subtitles] Querying Stremio: ${stremioUrl}`);
    const subRes = await fetch(stremioUrl);
    if (!subRes.ok) {
      console.warn(`[Subtitles] Stremio request failed: ${subRes.status}`);
      return [];
    }
    
    const subData = await subRes.json();
    if (!subData.subtitles || !Array.isArray(subData.subtitles)) {
      console.warn('[Subtitles] No subtitles found in Stremio response');
      return [];
    }

    console.log(`[Subtitles] Found ${subData.subtitles.length} subtitles in Stremio`);

    const formattedSubs: ExternalSubtitle[] = [];
    const seenLangs = new Set<string>();

    const languageMap: Record<string, { code: string; label: string }> = {
      'eng': { code: 'en', label: 'English' },
      'hin': { code: 'hi', label: 'Hindi' },
      'spa': { code: 'es', label: 'Spanish' },
      'fre': { code: 'fr', label: 'French' },
      'ger': { code: 'de', label: 'German' },
      'jpn': { code: 'ja', label: 'Japanese' },
      'kor': { code: 'ko', label: 'Korean' },
      'por': { code: 'pt', label: 'Portuguese' },
      'ara': { code: 'ar', label: 'Arabic' },
      'chi': { code: 'zh', label: 'Chinese' }
    };

    for (const sub of subData.subtitles) {
      const rawLang = sub.lang || 'unk';
      const mapping = languageMap[rawLang];
      
      if (mapping && !seenLangs.has(mapping.code)) {
        seenLangs.add(mapping.code);
        formattedSubs.push({
          lang: mapping.code,
          label: mapping.label,
          url: sub.url
        });
      }
    }

    memoryCache.set(cacheKey, formattedSubs);
    return formattedSubs;
  } catch (error) {
    console.error('Failed to fetch external subtitles:', error);
    return [];
  }
}
