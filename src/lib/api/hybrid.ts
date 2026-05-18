import { 
  getTrendingAnime, searchAniList, getAnimeDetail, 
  getAnimeByMalId, queryAniList, getAiringSchedule 
} from './anilist';
import type { AniListPageResponse } from '@/types/anilist';
import { getSchedule, getTopAnime, searchJikan } from './jikan';
import { getTrendingMovies, getTrendingTV, searchTMDB, getMovieTrailerKey, getTVTrailerKey } from './tmdb';
import type { AniListMedia } from '@/types/anilist';
import type { JikanAnime } from '@/types/jikan';
import type { TMDBMovie, TMDBTVShow } from '@/types/tmdb';
import type { MediaItem } from '@/types/media';

// Helper to normalize strings or empty values
const safeStr = (s?: string | null) => s || '';

/**
 * Fetch hybrid schedule for a given day with Jikan/AniList fallback
 */
export async function getHybridSchedule(day: string): Promise<any[]> {
  // Map day string to start/end timestamps for AniList
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = days.indexOf(day.toLowerCase());
  
  // Get start/end of that day in UTC
  const now = new Date();
  const today = now.getDay();
  const diff = dayIndex - today;
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + diff);
  targetDate.setHours(0, 0, 0, 0);
  const start = Math.floor(targetDate.getTime() / 1000);
  const end = start + 86400;

  try {
    const jikan = await getSchedule(day);
    if (jikan && jikan.length > 0) return jikan;
  } catch (err) {
    console.warn('Jikan schedule failed, falling back to AniList', err);
  }

  try {
    const anilist = await getAiringSchedule(start, end);
    return anilist.map(m => ({
      mal_id: m.idMal || m.id,
      title: m.title.english || m.title.romaji,
      broadcast: m.broadcast,
      episodes: m.airingEpisode
    }));
  } catch (err) {
    console.error('AniList schedule fallback failed', err);
    return [];
  }
}

/**
 * Extract raw numeric ID from prefixed hybrid ID (e.g. "anilist-21" -> 21)
 */
export function extractId(prefixedId: string | number | null): number {
  if (prefixedId === null || prefixedId === undefined) return 0;
  if (typeof prefixedId === 'number') return prefixedId;
  const parts = String(prefixedId).split('-');
  const lastPart = parts[parts.length - 1];
  return Number(lastPart) || 0;
}

export function mapAniListToMediaItem(item: AniListMedia): MediaItem {
  const title = item.title?.english || item.title?.romaji || 'Unknown Title';
  return {
    id: `anilist-${item.id}`,
    source: 'anilist',
    type: item.type?.toLowerCase() as 'anime' | 'manga' || 'anime',
    title,
    nativeTitle: item.title?.native ?? undefined,
    posterUrl: item.coverImage?.extraLarge || item.coverImage?.large || '',
    bannerUrl: item.bannerImage ?? undefined,
    description: safeStr(item.description),
    score: item.averageScore ? Number((item.averageScore / 10).toFixed(1)) : 0,
    year: item.seasonYear || item.startDate?.year || new Date().getFullYear(),
    status: item.status || 'FINISHED',
    format: item.format || 'TV',
    formatLabel: item.format === 'TV' ? 'TV Show' : item.format === 'MOVIE' ? 'Movie' : item.format || 'TV',
    genres: item.genres || [],
    tags: item.tags?.map(t => t.name) || [],
    episodeCount: item.episodes ?? undefined,
    chapterCount: item.chapters ?? undefined,
    duration: item.duration ? `${item.duration} min` : undefined,
    season: item.season ?? undefined,
    seasonYear: item.seasonYear ?? undefined,
    trailerYoutubeId: item.trailer?.site === 'youtube' ? item.trailer.id : undefined,
    malId: item.idMal ?? undefined,
    anilistId: item.id,
    studios: item.studios?.nodes?.map(n => n.name) || [],
    countryOfOrigin: item.countryOfOrigin ?? undefined,
    nextAiringEpisode: item.nextAiringEpisode ?? undefined,
    sourceMedia: item.source ?? undefined,
    startDate: (item.startDate && typeof item.startDate.year === 'number' && typeof item.startDate.month === 'number' && typeof item.startDate.day === 'number')
      ? { year: item.startDate.year, month: item.startDate.month, day: item.startDate.day }
      : undefined,
    characters: item.characters?.edges?.map(e => ({
      id: e.node.id,
      name: e.node.name.full,
      image: e.node.image.large,
      role: e.role,
      voiceActor: e.voiceActors?.[0] ? {
        name: e.voiceActors[0].name.full,
        image: e.voiceActors[0].image.large,
        language: e.voiceActors[0].languageV2
      } : undefined
    })),
    staff: item.staff?.edges?.map(e => ({
      id: e.node.id,
      name: e.node.name.full,
      image: e.node.image.large,
      role: e.role
    })),
    recommendations: item.recommendations?.nodes
      ?.map(n => n?.mediaRecommendation)
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map(r => ({
        id: `anilist-${r.id}`,
        title: r.title?.english || r.title?.romaji || 'Unknown',
        posterUrl: (r.coverImage as any)?.large || (r.coverImage as any)?.medium || '',
        type: r.type?.toLowerCase() as any,
        formatLabel: r.format || 'TV',
        year: r.seasonYear ?? undefined
      })) || [],
    relations: item.relations?.edges
      ?.filter((e): e is NonNullable<typeof e> => !!e && !!e.node)
      .map(e => ({
        id: `anilist-${e.node.id}`,
        title: e.node.title?.english || e.node.title?.romaji || 'Unknown',
        posterUrl: (e.node.coverImage as any)?.large || (e.node.coverImage as any)?.medium || '',
        type: e.node.type?.toLowerCase() as any,
        relationType: e.relationType || '',
        formatLabel: e.node.format || 'TV'
      })) || []
  };
}

export function mapJikanToMediaItem(item: JikanAnime): MediaItem {
  const title = item.title_english || item.title || 'Unknown Title';
  return {
    id: `jikan-${item.mal_id}`,
    source: 'jikan',
    type: 'anime',
    title,
    nativeTitle: item.title_japanese || undefined,
    posterUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
    bannerUrl: undefined,
    description: safeStr(item.synopsis),
    score: item.score || 0,
    year: item.year || (item.aired?.from ? new Date(item.aired.from).getFullYear() : new Date().getFullYear()),
    status: item.status === 'Currently Airing' ? 'RELEASING' : item.status === 'Finished Airing' ? 'FINISHED' : 'NOT_YET_RELEASED',
    format: item.type || 'TV',
    formatLabel: item.type === 'TV' ? 'TV Show' : item.type || 'Anime',
    genres: item.genres?.map(g => g.name) || [],
    episodeCount: item.episodes || undefined,
    duration: item.duration || undefined,
    malId: item.mal_id,
    trailerYoutubeId: item.trailer?.youtube_id || undefined,
    studios: item.studios?.map(s => s.name) || [],
  };
}

export function mapTMDBMovieToMediaItem(movie: TMDBMovie): MediaItem {
  return {
    id: `tmdb-movie-${movie.id}`,
    source: 'tmdb',
    type: 'movie',
    title: movie.title || movie.original_title || 'Unknown Movie',
    posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
    bannerUrl: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : undefined,
    description: safeStr(movie.overview),
    score: movie.vote_average ? Number(movie.vote_average.toFixed(1)) : 0,
    year: movie.release_date ? new Date(movie.release_date).getFullYear() : new Date().getFullYear(),
    status: movie.status || 'Released',
    format: 'MOVIE',
    formatLabel: 'Movie',
    genres: movie.genres?.map(g => g.name) || [],
    duration: movie.runtime ? `${movie.runtime} min` : undefined,
    tmdbId: movie.id,
    countryOfOrigin: movie.origin_country?.[0] || 'US',
    trailerYoutubeId: movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key || movie.videos?.results?.find(v => v.site === 'YouTube')?.key,
    characters: movie.credits?.cast?.slice(0, 15).map(c => ({
      id: c.id,
      name: c.name,
      image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : '',
      role: c.character
    })),
    staff: movie.credits?.crew?.filter(c => ['Director', 'Writer', 'Producer'].includes(c.job)).slice(0, 8).map(c => ({
      id: c.id,
      name: c.name,
      image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : '',
      role: c.job
    })),
    recommendations: movie.recommendations?.results?.slice(0, 15).map(r => ({
      id: `tmdb-movie-${r.id}`,
      title: r.title || r.original_title || 'Unknown',
      posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : '',
      type: 'movie',
      formatLabel: 'Movie',
      year: r.release_date ? new Date(r.release_date).getFullYear() : undefined
    }))
  };
}

export function mapTMDBTVToMediaItem(tv: TMDBTVShow): MediaItem {
  return {
    id: `tmdb-tv-${tv.id}`,
    source: 'tmdb',
    type: 'tv',
    title: tv.name || tv.original_name || 'Unknown Show',
    posterUrl: tv.poster_path ? `https://image.tmdb.org/t/p/w500${tv.poster_path}` : '',
    bannerUrl: tv.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tv.backdrop_path}` : undefined,
    description: safeStr(tv.overview),
    score: tv.vote_average ? Number(tv.vote_average.toFixed(1)) : 0,
    year: tv.first_air_date ? new Date(tv.first_air_date).getFullYear() : new Date().getFullYear(),
    status: tv.status === 'Ended' ? 'FINISHED' : 'RELEASING',
    format: 'TV',
    formatLabel: 'TV Series',
    genres: tv.genres?.map(g => g.name) || [],
    episodeCount: tv.number_of_episodes,
    tmdbId: tv.id,
    countryOfOrigin: tv.origin_country?.[0] || 'US',
    trailerYoutubeId: tv.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key || tv.videos?.results?.find(v => v.site === 'YouTube')?.key,
    characters: tv.credits?.cast?.slice(0, 15).map(c => ({
      id: c.id,
      name: c.name,
      image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : '',
      role: c.character
    })),
    staff: tv.credits?.crew?.filter(c => ['Director', 'Writer', 'Producer', 'Executive Producer'].includes(c.job)).slice(0, 8).map(c => ({
      id: c.id,
      name: c.name,
      image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : '',
      role: c.job
    })),
    recommendations: tv.recommendations?.results?.slice(0, 15).map(r => ({
      id: `tmdb-tv-${r.id}`,
      title: r.name || r.original_name || 'Unknown',
      posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : '',
      type: 'tv',
      formatLabel: 'TV Show',
      year: r.first_air_date ? new Date(r.first_air_date).getFullYear() : undefined
    }))
  };
}

/**
 * Fetch unified trending combining Anime, Movies, and TV Shows
 */
export async function getHybridTrending(page: number | boolean = 1, hideAdult = true): Promise<MediaItem[]> {
  const actualPage = typeof page === 'number' ? page : 1;
  const actualHideAdult = typeof page === 'boolean' ? page : hideAdult;

  const items: MediaItem[] = [];
  try {
    // Parallel fetch from multiple sources with pagination
    const [anime, movies, tv] = await Promise.allSettled([
      getTrendingAnime(10, actualPage, actualHideAdult),
      getTrendingMovies('week', actualPage),
      getTrendingTV('week', actualPage)
    ]);

    if (anime.status === 'fulfilled') {
      items.push(...anime.value.map(mapAniListToMediaItem));
    }
    
    // Fetch TMDB Trending Movies & TV
    if (movies.status === 'fulfilled') {
      const movieItems = await Promise.all(movies.value.slice(0, 10).map(async (m) => {
        const item = mapTMDBMovieToMediaItem(m);
        // Only fetch trailers for the first 5 to avoid heavy API load
        if (movies.value.indexOf(m) < 5) {
          item.trailerYoutubeId = await getMovieTrailerKey(m.id) || undefined;
        }
        return item;
      }));
      items.push(...movieItems);
    }
    if (tv.status === 'fulfilled') {
      const tvItems = await Promise.all(tv.value.slice(0, 10).map(async (t) => {
        const item = mapTMDBTVToMediaItem(t);
        if (tv.value.indexOf(t) < 5) {
          item.trailerYoutubeId = await getTVTrailerKey(t.id) || undefined;
        }
        return item;
      }));
      items.push(...tvItems);
    }
  } catch (err) {
    console.error('TMDB fetching failed in hybrid wrapper', err);
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped = items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  
  // Shuffle for variety, but seed with page so it's consistent during scroll
  return deduped.sort(() => Math.random() - 0.5);
}

/**
 * Fetch real episode lists for Anime (Jikan with AniList fallback) or TMDB
 */
export async function getMediaEpisodes(id: string, type: string, season = 1) {
  const numericId = extractId(id);

  if (type === 'anime') {
    // Try Jikan first
    try {
      // 1. Fetch base episode data
      const baseRes = await (await fetch(`/api/jikan/anime/${numericId}/episodes`)).json();
      const baseEps = baseRes.data || [];

      // 2. Fetch episode videos (which contain thumbnails)
      const videoRes = await (await fetch(`/api/jikan/anime/${numericId}/episodes/videos`)).json();
      const videoEps = videoRes.data || [];

      // 3. Merge thumbnails into base data
      if (baseEps.length > 0) {
        return baseEps.map((ep: any) => {
          // Find matching video for thumbnail
          const videoMatch = videoEps.find((v: any) => v.mal_id === ep.mal_id);
          return {
            number: ep.mal_id,
            title: ep.title || `Episode ${ep.mal_id}`,
            thumbnail: videoMatch?.images?.jpg?.image_url || videoMatch?.images?.webp?.image_url || null,
            aired: ep.aired || null,
            filler: ep.filler,
            recap: ep.recap
          };
        });
      }
    } catch (err) {
      console.warn('Jikan episodes failed, falling back to AniList', err);
    }

    // Fallback to AniList (limited info)
    try {
      const media = await getAnimeDetail(String(numericId));
      if (media && media.episodes) {
        return Array.from({ length: media.episodes }, (_, i) => ({
          number: i + 1,
          title: `Episode ${i + 1}`,
          thumbnail: media.bannerImage || media.coverImage.extraLarge,
          aired: null
        }));
      }
    } catch (err) {
      console.error('AniList episode fallback failed', err);
    }
  } else if (type === 'tv' || type === 'movie') {
    // TMDB implementation
    try {
      if (type === 'tv') {
        const res = await (await fetch(`/api/tmdb/tv/${numericId}/season/${season}`)).json();
        return res.episodes.map((ep: any) => ({
          number: ep.episode_number,
          title: ep.name || `Episode ${ep.episode_number}`,
          thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
          aired: ep.air_date,
          overview: ep.overview
        }));
      } else {
        // Movies have only one "episode"
        return [{
          number: 1,
          title: 'Full Movie',
          thumbnail: null,
          aired: null
        }];
      }
    } catch (err) {
      console.error('TMDB episode fetch failed', err);
    }
  }

  return [];
}

/**
 * Search across AniList (fallback to Jikan) and TMDB multi search
 */
export async function searchHybrid(query: string, page = 1, hideAdult = true): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  if (!query || query.length < 2) return items;

  // Concurrent search across all providers with timeouts/error handling
  const results = await Promise.allSettled([
    searchAniList(query, 'ANIME', 15, page, hideAdult),
    searchAniList(query, 'MANGA', 10, page, hideAdult),
    searchTMDB(query, 'multi', page)
  ]);

  // Handle AniList Anime
  if (results[0].status === 'fulfilled') {
    items.push(...(results[0].value.data?.Page?.media?.map(mapAniListToMediaItem) || []));
  } else {
    console.warn('AniList Anime search failed');
    try {
      const jikanRes = await searchJikan(query, 'anime', page);
      items.push(...(jikanRes.data?.slice(0, 15).map(mapJikanToMediaItem) || []));
    } catch (err) { console.error('Jikan fallback failed', err); }
  }

  // Handle AniList Manga
  if (results[1].status === 'fulfilled') {
    items.push(...(results[1].value.data?.Page?.media?.map(mapAniListToMediaItem) || []));
  }

  // Handle TMDB (Movies & TV)
  if (results[2].status === 'fulfilled') {
    const tmdbData = results[2].value as any;
    const tmdbResults = tmdbData.results || [];
    for (const item of tmdbResults) {
      if (item.media_type === 'movie' || (!item.media_type && item.title)) {
        items.push(mapTMDBMovieToMediaItem(item as TMDBMovie));
      } else if (item.media_type === 'tv' || (!item.media_type && item.name)) {
        items.push(mapTMDBTVToMediaItem(item as TMDBTVShow));
      }
    }
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  return items
    .filter(item => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}
/**
 * Fetch hybrid recommendations
 */
export async function getHybridRecommendations(id: string, type: string): Promise<MediaItem[]> {
  const numericId = extractId(id);
  
  if (type === 'anime') {
    try {
      const media = await getAnimeDetail(String(numericId));
      return media.recommendations?.nodes
        ?.map(n => n?.mediaRecommendation)
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map((r: any) => ({
          id: `anilist-${r.id}`,
          source: 'anilist',
          type: 'anime',
          title: r.title?.english || r.title?.romaji || 'Unknown Title',
          posterUrl: r.coverImage?.large || r.coverImage?.medium || '',
          bannerUrl: undefined,
          description: '',
          score: r.averageScore ? Number((r.averageScore / 10).toFixed(1)) : 0,
          year: r.seasonYear ?? new Date().getFullYear(),
          status: r.status || 'FINISHED',
          format: r.format || 'TV',
          formatLabel: r.format || 'TV',
          genres: [],
        })) || [];
    } catch (err) {
      console.error('Hybrid recommendations failed for anime', err);
    }
  } else if (type === 'movie' || type === 'tv') {
    try {
      const res = await (await fetch(`/api/tmdb/${type}/${numericId}/recommendations`)).json();
      return (res.results || []).slice(0, 12).map((item: any) => {
        if (type === 'movie') return mapTMDBMovieToMediaItem(item);
        return mapTMDBTVToMediaItem(item);
      });
    } catch (err) {
      console.error('Hybrid recommendations failed for TMDB', err);
    }
  }
  
  return [];
}
