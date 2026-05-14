import { getTrendingAnime, getUpcomingAnime, searchAniList } from './anilist';
import { getTopAnime, searchJikan } from './jikan';
import { getTrendingMovies, getTrendingTV, searchTMDB } from './tmdb';
import type { AniListMedia } from '@/types/anilist';
import type { JikanAnime } from '@/types/jikan';
import type { TMDBMovie, TMDBTVShow } from '@/types/tmdb';
import type { MediaItem } from '@/types/media';

// Helper to normalize strings or empty values
const safeStr = (s?: string | null) => s || '';

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
    nativeTitle: item.title?.native,
    posterUrl: item.coverImage?.extraLarge || item.coverImage?.large || '',
    bannerUrl: item.bannerImage || undefined,
    description: safeStr(item.description),
    score: item.averageScore ? Number((item.averageScore / 10).toFixed(1)) : 0,
    year: item.seasonYear || item.startDate?.year || new Date().getFullYear(),
    status: item.status || 'FINISHED',
    format: item.format || 'TV',
    formatLabel: item.format === 'TV' ? 'TV Show' : item.format === 'MOVIE' ? 'Movie' : item.format || 'TV',
    genres: item.genres || [],
    tags: item.tags?.map(t => t.name) || [],
    episodeCount: item.episodes,
    chapterCount: item.chapters,
    duration: item.duration ? `${item.duration} min` : undefined,
    season: item.season,
    seasonYear: item.seasonYear,
    trailerYoutubeId: item.trailer?.site === 'youtube' ? item.trailer.id : undefined,
    malId: item.idMal,
    anilistId: item.id,
    studios: item.studios?.nodes?.map(n => n.name) || [],
    countryOfOrigin: item.countryOfOrigin,
    nextAiringEpisode: item.nextAiringEpisode,
    sourceMedia: item.source,
    startDate: item.startDate,
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
    recommendations: item.recommendations?.nodes?.map(n => n.mediaRecommendation).filter(Boolean).map(r => ({
      id: `anilist-${r.id}`,
      title: r.title.english || r.title.romaji || 'Unknown',
      posterUrl: r.coverImage.large,
      type: r.type?.toLowerCase() as any,
      formatLabel: r.format,
      year: r.seasonYear
    })),
    relations: item.relations?.edges?.map(e => ({
      id: `anilist-${e.node.id}`,
      title: e.node.title.english || e.node.title.romaji || 'Unknown',
      posterUrl: e.node.coverImage.large,
      type: e.node.type?.toLowerCase() as any,
      relationType: e.relationType,
      formatLabel: e.node.format
    }))
  };
}

export function mapJikanToMediaItem(item: JikanAnime): MediaItem {
  const title = item.title_english || item.title || 'Unknown Title';
  return {
    id: `jikan-${item.mal_id}`,
    source: 'jikan',
    type: 'anime',
    title,
    nativeTitle: item.title_japanese,
    posterUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
    bannerUrl: undefined,
    description: safeStr(item.synopsis),
    score: item.score || 0,
    year: item.year || (item.aired?.from ? new Date(item.aired.from).getFullYear() : new Date().getFullYear()),
    status: item.status === 'Currently Airing' ? 'RELEASING' : item.status === 'Finished Airing' ? 'FINISHED' : 'NOT_YET_RELEASED',
    format: item.type || 'TV',
    formatLabel: item.type === 'TV' ? 'TV Show' : item.type || 'Anime',
    genres: item.genres?.map(g => g.name) || [],
    episodeCount: item.episodes,
    duration: item.duration,
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
export async function getHybridTrending(page = 1): Promise<MediaItem[]> {
  const items: MediaItem[] = [];

  // Try fetching AniList Trending Anime
  try {
    const query = `
      query ($perPage: Int, $page: Int) {
        Page(perPage: $perPage, page: $page) {
          media(type: ANIME, sort: TRENDING_DESC) {
            id idMal title { romaji english native }
            description(asHtml: false)
            coverImage { extraLarge large } bannerImage
            trailer { id site }
            format status season seasonYear episodes duration
            averageScore meanScore genres
            studios(isMain: true) { nodes { name } }
            nextAiringEpisode { airingAt episode }
          }
        }
      }`;
    const res = await queryAniList<AniListPageResponse>(query, { perPage: 12, page });
    items.push(...res.data.Page.media.map(mapAniListToMediaItem));
  } catch (err) {
    console.warn('AniList getTrendingAnime failed, falling back to Jikan getTopAnime', err);
    try {
      const jikan = await getTopAnime('airing', page);
      items.push(...(jikan.data?.slice(0, 12).map(mapJikanToMediaItem) || []));
    } catch (jikanErr) {
      console.error('Jikan fallback also failed', jikanErr);
    }
  }

  // Fetch TMDB Trending Movies & TV
  try {
    const [movies, tv] = await Promise.allSettled([
      getTrendingMovies('week', page),
      getTrendingTV('week', page)
    ]);

    if (movies.status === 'fulfilled') {
      items.push(...movies.value.slice(0, 10).map(mapTMDBMovieToMediaItem));
    }
    if (tv.status === 'fulfilled') {
      items.push(...tv.value.slice(0, 10).map(mapTMDBTVToMediaItem));
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
  // For now just return as is or shuffle
  return deduped;
}

/**
 * Search across AniList (fallback to Jikan) and TMDB multi search
 */
export async function searchHybrid(query: string, page = 1): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  if (!query || query.length < 2) return items;

  // Concurrent search across all providers with timeouts/error handling
  const results = await Promise.allSettled([
    searchAniList(query, 'ANIME', 15, page),
    searchAniList(query, 'MANGA', 10, page),
    searchTMDB(query, 'multi', page)
  ]);

  // Handle AniList Anime
  if (results[0].status === 'fulfilled') {
    items.push(...results[0].value.media.map(mapAniListToMediaItem));
  } else {
    console.warn('AniList Anime search failed');
    try {
      const jikanRes = await searchJikan(query, 'anime', page);
      items.push(...(jikanRes.data?.slice(0, 15).map(mapJikanToMediaItem) || []));
    } catch (err) { console.error('Jikan fallback failed', err); }
  }

  // Handle AniList Manga
  if (results[1].status === 'fulfilled') {
    items.push(...results[1].value.media.map(mapAniListToMediaItem));
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
