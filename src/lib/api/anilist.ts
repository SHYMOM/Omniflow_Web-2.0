import axios from 'axios';
import type { AniListMedia, AniListPageResponse, AniListSingleResponse } from '@/types/anilist';

const ANILIST_PROXY = '/api/anilist';

/**
 * Execute an AniList GraphQL query with direct client-side fetch and server-side proxy fallback
 */
export async function queryAniList<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (typeof window !== 'undefined') {
    try {
      const res = await window.fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
      if (res.ok) {
        return await res.json();
      }
      console.warn('Direct AniList fetch failed with status:', res.status, 'falling back to proxy.');
    } catch (err) {
      console.warn('Direct AniList fetch failed, falling back to proxy:', err);
    }
  }

  const { data } = await axios.post<T>(ANILIST_PROXY, { query, variables });
  return data;
}

// ─── Hybrid Fallback Utilities ───────────────────────────────
function mapJikanToAniListMedia(j: any): AniListMedia {
  return {
    id: j.mal_id,
    idMal: j.mal_id,
    title: {
      romaji: j.title || 'Unknown',
      english: j.title_english || j.title || '',
      native: j.title_japanese || j.title || '',
    },
    coverImage: {
      extraLarge: j.images?.webp?.large_image_url || j.images?.jpg?.large_image_url || '',
      large: j.images?.webp?.image_url || j.images?.jpg?.image_url || '',
    },
    bannerImage: j.images?.webp?.large_image_url || j.images?.jpg?.large_image_url || '',
    description: j.synopsis || '',
    averageScore: j.score ? Math.round(j.score * 10) : 0,
    seasonYear: j.year || new Date().getFullYear(),
    status: j.status === 'Finished Airing' ? 'FINISHED' : 'RELEASING',
    format: j.type?.toUpperCase() === 'TV' ? 'TV' : j.type?.toUpperCase() === 'MOVIE' ? 'MOVIE' : 'TV',
    genres: j.genres?.map((g: any) => g.name) || [],
    episodes: j.episodes || null,
    duration: j.duration ? parseInt(j.duration) : null,
    season: j.season?.toUpperCase() || null,
    trailer: j.trailer?.youtube_id ? {
      id: j.trailer.youtube_id,
      site: 'youtube',
    } : null,
    updatedAt: Math.floor(Date.now() / 1000),
  } as any;
}

let jikanQueue: Promise<any> = Promise.resolve();

async function fetchJikanFallback(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const result = jikanQueue.then(async () => {
    // Spacer delay to honor Jikan rate limits (max 3 req/sec)
    await new Promise(r => setTimeout(r, 500));

    const queryStr = new URLSearchParams(params).toString();
    const url = `https://api.jikan.moe/v4${endpoint}${queryStr ? '?' + queryStr : ''}`;
    
    if (typeof window !== 'undefined') {
      try {
        const res = await window.fetch(url);
        if (res.ok) {
          const body = await res.json();
          return body.data;
        }
      } catch (e: any) {
        console.warn('Direct Jikan fallback failed, trying proxy: ' + (e?.message || e));
      }

      try {
        const proxyUrl = `/api/jikan${endpoint}`;
        const { data } = await axios.get<{ data: any }>(proxyUrl, { params });
        return data.data;
      } catch (e: any) {
        console.warn('Client proxy Jikan fallback failed: ' + (e?.message || e));
      }
    }
    
    try {
      const { data } = await axios.get<{ data: any }>(`https://api.jikan.moe/v4${endpoint}`, {
        params,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
      });
      return data.data;
    } catch (e: any) {
      console.warn('Server-side direct Jikan fallback failed: ' + (e?.message || e));
      throw e;
    }
  });

  // Advance the queue pointer so next requests wait for this one
  jikanQueue = result.catch(() => {});
  
  return result;
}

// ─── Trending ────────────────────────────────────────────────
export async function getTrendingAnime(perPage = 8, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  try {
    const query = `
      query ($perPage: Int, $page: Int, $hideAdult: Boolean) {
        Page(perPage: $perPage, page: $page) {
          media(type: ANIME, sort: TRENDING_DESC, isAdult: $hideAdult) {
            id idMal title { romaji english native }
            description(asHtml: false)
            coverImage { extraLarge large } bannerImage
            format status season seasonYear averageScore
            genres episodes nextAiringEpisode { episode airingAt }
            trailer { id site thumbnail }
          }
        }
      }
    `;
    const res = await queryAniList<AniListPageResponse>(query, { perPage, page, hideAdult: hideAdult ? false : undefined });
    return res.data.Page.media;
  } catch (err) {
    console.warn('getTrendingAnime failed, falling back to Jikan:', err);
    try {
      const data = await fetchJikanFallback('/top/anime', { filter: 'bypopularity', page, limit: Math.min(perPage, 25) });
      return (data || []).map(mapJikanToAniListMedia);
    } catch (fallbackErr) {
      console.error('Jikan fallback for trending failed:', fallbackErr);
      return [];
    }
  }
}

// ─── Popular This Season ─────────────────────────────────────
export async function getThisSeasonAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  try {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const season = month < 3 ? 'WINTER' : month < 6 ? 'SPRING' : month < 9 ? 'SUMMER' : 'FALL';

    const query = `
      query ($season: MediaSeason, $seasonYear: Int, $perPage: Int, $page: Int, $hideAdult: Boolean) {
        Page(perPage: $perPage, page: $page) {
          media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, isAdult: $hideAdult) {
            id idMal title { romaji english native }
            coverImage { extraLarge large }
            format status season seasonYear averageScore
            genres episodes nextAiringEpisode { episode airingAt }
          }
        }
      }
    `;
    const res = await queryAniList<AniListPageResponse>(query, { season, seasonYear: year, perPage, page, hideAdult: hideAdult ? false : undefined });
    return res.data.Page.media;
  } catch (err) {
    console.warn('getThisSeasonAnime failed, falling back to Jikan:', err);
    try {
      const data = await fetchJikanFallback('/seasons/now', { page, limit: Math.min(perPage, 25) });
      return (data || []).map(mapJikanToAniListMedia);
    } catch (fallbackErr) {
      console.error('Jikan fallback for popular this season failed:', fallbackErr);
      return [];
    }
  }
}

// ─── Popular All Time ────────────────────────────────────────
export async function getPopularAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  try {
    const query = `
      query ($perPage: Int, $page: Int, $hideAdult: Boolean) {
        Page(perPage: $perPage, page: $page) {
          media(type: ANIME, sort: POPULARITY_DESC, isAdult: $hideAdult) {
            id idMal title { romaji english native }
            coverImage { extraLarge large }
            format status season seasonYear averageScore
            genres episodes
          }
        }
      }
    `;
    const res = await queryAniList<AniListPageResponse>(query, { perPage, page, hideAdult: hideAdult ? false : undefined });
    return res.data.Page.media;
  } catch (err) {
    console.warn('getPopularAnime failed, falling back to Jikan:', err);
    try {
      const data = await fetchJikanFallback('/top/anime', { filter: 'bypopularity', page, limit: Math.min(perPage, 25) });
      return (data || []).map(mapJikanToAniListMedia);
    } catch (fallbackErr) {
      console.error('Jikan fallback for popular failed:', fallbackErr);
      return [];
    }
  }
}

// ─── Top Rated ───────────────────────────────────────────────
export async function getTopRatedAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  try {
    const query = `
      query ($perPage: Int, $page: Int, $hideAdult: Boolean) {
        Page(perPage: $perPage, page: $page) {
          media(type: ANIME, sort: SCORE_DESC, isAdult: $hideAdult) {
            id idMal title { romaji english native }
            coverImage { extraLarge large }
            format status season seasonYear averageScore
            genres episodes
          }
        }
      }
    `;
    const res = await queryAniList<AniListPageResponse>(query, { perPage, page, hideAdult: hideAdult ? false : undefined });
    return res.data.Page.media;
  } catch (err) {
    console.warn('getTopRatedAnime failed, falling back to Jikan:', err);
    try {
      const data = await fetchJikanFallback('/top/anime', { page, limit: Math.min(perPage, 25) });
      return (data || []).map(mapJikanToAniListMedia);
    } catch (fallbackErr) {
      console.error('Jikan fallback for top rated failed:', fallbackErr);
      return [];
    }
  }
}

// ─── Top Upcoming ────────────────────────────────────────────
export async function getTopUpcomingAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  try {
    const query = `
      query ($perPage: Int, $page: Int, $hideAdult: Boolean) {
        Page(perPage: $perPage, page: $page) {
          media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: $hideAdult) {
            id idMal title { romaji english native }
            coverImage { extraLarge large } description(asHtml: false)
            source format genres
            nextAiringEpisode { episode airingAt }
          }
        }
      }
    `;
    const res = await queryAniList<AniListPageResponse>(query, { perPage, page, hideAdult: hideAdult ? false : undefined });
    return res.data.Page.media;
  } catch (err) {
    console.warn('getTopUpcomingAnime failed, falling back to Jikan:', err);
    try {
      const data = await fetchJikanFallback('/top/anime', { filter: 'upcoming', page, limit: Math.min(perPage, 25) });
      return (data || []).map(mapJikanToAniListMedia);
    } catch (fallbackErr) {
      console.error('Jikan fallback for upcoming failed:', fallbackErr);
      return [];
    }
  }
}

// ─── Recently Updated ────────────────────────────────────────
export async function getRecentlyUpdatedAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int, $page: Int, $end: Int) {
      Page(perPage: $perPage, page: $page) {
        airingSchedules(airingAt_lesser: $end, sort: TIME_DESC) {
          airingAt
          episode
          media {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large }
            bannerImage
            episodes
            format
            status
            isAdult
          }
        }
      }
    }
  `;
  const end = Math.floor(Date.now() / 1000);
  try {
    const res = await queryAniList<any>(query, { perPage: perPage * 2, page, end });
    const schedules = res?.data?.Page?.airingSchedules || [];
    
    const seen = new Set<number>();
    const list: AniListMedia[] = [];
    
    for (const s of schedules) {
      if (!s.media) continue;
      if (hideAdult && s.media.isAdult) continue;
      if (seen.has(s.media.id)) continue;
      seen.add(s.media.id);
      
      list.push({
        ...s.media,
        episodes: s.episode, // Set episodes to the actual aired episode number
        updatedAt: s.airingAt, // Inject airing time as updatedAt for exact time-ago calculations
        nextAiringEpisode: null, // Clear nextAiringEpisode to use genuine updatedAt calculation
      } as any);
      
      if (list.length >= perPage) break;
    }
    
    return list;
  } catch (err) {
    console.warn('getRecentlyUpdatedAnime failed, falling back to Jikan schedule:', err);
    try {
      const data = await fetchJikanFallback('/schedules', { page, limit: perPage });
      const seen = new Set<number>();
      const list: AniListMedia[] = [];
      
      for (const s of (data || [])) {
        if (seen.has(s.mal_id)) continue;
        seen.add(s.mal_id);
        
        list.push({
          ...mapJikanToAniListMedia(s),
          updatedAt: Math.floor(Date.now() / 1000) - (seen.size * 3600) - ((page - 1) * perPage * 3600), // Airing sequence offset by page
        } as any);
        
        if (list.length >= perPage) break;
      }
      return list;
    } catch (fallbackErr) {
      console.error('Jikan fallback for recently updated failed:', fallbackErr);
      return [];
    }
  }
}

// ─── Detail ──────────────────────────────────────────────────
export async function getAnimeDetail(id: string): Promise<AniListMedia> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id idMal title { romaji english native }
        description(asHtml: false)
        coverImage { extraLarge large } bannerImage
        format status season seasonYear averageScore meanScore
        genres episodes duration source
        trailer { id site thumbnail }
        nextAiringEpisode { episode airingAt }
        studios(isMain: true) { nodes { id name siteUrl } }
        externalLinks { id url site }
        characters(sort: ROLE, perPage: 25) {
          edges {
            role
            node {
              id name { full native }
              image { large medium }
            }
          }
        }
        staff(perPage: 15) {
          edges {
            role
            node {
              id name { full native }
              image { large medium }
            }
          }
        }
        relations {
          edges {
            relationType(version: 2)
            node {
              id idMal title { romaji english native }
              coverImage { large medium }
              type format status averageScore seasonYear
            }
          }
        }
        recommendations(perPage: 15, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id idMal title { romaji english native }
              coverImage { large medium }
              type format status averageScore seasonYear
            }
          }
        }
      }
    }
  `;
  try {
    const res = await queryAniList<AniListSingleResponse>(query, { id: parseInt(id) });
    return res.data.Media;
  } catch (err) {
    console.warn('getAnimeDetail failed, falling back to Jikan Detail:', err);
    try {
      const data = await fetchJikanFallback(`/anime/${id}`);
      return mapJikanToAniListMedia(data);
    } catch (fallbackErr) {
      console.error('Jikan fallback for detail failed:', fallbackErr);
      throw err;
    }
  }
}

export async function getAnimeByMalId(idMal: string): Promise<AniListMedia> {
  const query = `
    query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        id idMal title { romaji english native }
        description(asHtml: false)
        coverImage { extraLarge large } bannerImage
        format status season seasonYear averageScore meanScore
        genres episodes duration source
        trailer { id site thumbnail }
        nextAiringEpisode { episode airingAt }
        studios(isMain: true) { nodes { id name siteUrl } }
        externalLinks { id url site }
        characters(sort: ROLE, perPage: 25) {
          edges {
            role
            node {
              id name { full native }
              image { large medium }
            }
          }
        }
        staff(perPage: 15) {
          edges {
            role
            node {
              id name { full native }
              image { large medium }
            }
          }
        }
        relations {
          edges {
            relationType(version: 2)
            node {
              id idMal title { romaji english native }
              coverImage { large medium }
              type format status averageScore seasonYear
            }
          }
        }
        recommendations(perPage: 15, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id idMal title { romaji english native }
              coverImage { large medium }
              type format status averageScore seasonYear
            }
          }
        }
      }
    }
  `;
  try {
    const res = await queryAniList<AniListSingleResponse>(query, { idMal: parseInt(idMal) });
    return res.data.Media;
  } catch (err) {
    console.warn('getAnimeByMalId failed, falling back to Jikan Detail:', err);
    try {
      const data = await fetchJikanFallback(`/anime/${idMal}`);
      return mapJikanToAniListMedia(data);
    } catch (fallbackErr) {
      console.error('Jikan fallback for detail by malId failed:', fallbackErr);
      throw err;
    }
  }
}

// ─── Search ──────────────────────────────────────────────────
export async function searchAniList(search: string, type: 'ANIME' | 'MANGA' = 'ANIME', perPage = 18, page = 1, hideAdult = true): Promise<AniListPageResponse> {
  const query = `
    query ($search: String, $type: MediaType, $perPage: Int, $page: Int, $hideAdult: Boolean) {
      Page(perPage: $perPage, page: $page) {
        pageInfo { hasNextPage currentPage lastPage }
        media(search: $search, type: $type, sort: SEARCH_MATCH, isAdult: $hideAdult) {
          id idMal title { romaji english native }
          coverImage { extraLarge large }
          format status season seasonYear averageScore
          genres episodes chapters volumes
        }
      }
    }
  `;
  const res = await queryAniList<AniListPageResponse>(query, { search, type, perPage, page, hideAdult: hideAdult ? false : undefined });
  return res;
}

// ─── Manga ───────────────────────────────────────────────────
export async function getPopularManga(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int, $page: Int, $hideAdult: Boolean) {
      Page(perPage: $perPage, page: $page) {
        media(type: MANGA, sort: POPULARITY_DESC, isAdult: $hideAdult) {
          id idMal title { romaji english native }
          coverImage { extraLarge large }
          format status averageScore
          genres chapters volumes
        }
      }
    }
  `;
  const res = await queryAniList<AniListPageResponse>(query, { perPage, page, hideAdult: hideAdult ? false : undefined });
  return res.data.Page.media;
}

export async function getTrendingManga(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int, $page: Int, $hideAdult: Boolean) {
      Page(perPage: $perPage, page: $page) {
        media(type: MANGA, sort: TRENDING_DESC, isAdult: $hideAdult) {
          id idMal title { romaji english native }
          coverImage { extraLarge large }
          format status averageScore chapters volumes
          genres
        }
      }
    }
  `;
  const res = await queryAniList<AniListPageResponse>(query, { perPage, page, hideAdult: hideAdult ? false : undefined });
  return res.data.Page.media;
}

export async function getAiringSchedule(start: number, end: number): Promise<any[]> {
  const query = `
    query ($start: Int, $end: Int) {
      Page(perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end) {
          media {
            id idMal title { romaji english native }
            coverImage { extraLarge large }
            format status season seasonYear averageScore
            genres episodes
          }
          airingAt
          episode
        }
      }
    }
  `;
  const res = await queryAniList<any>(query, { start, end });
  return res.data.Page.airingSchedules.map((s: any) => ({
    ...s.media,
    broadcast: { time: new Date(s.airingAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) },
    airingEpisode: s.episode
  }));
}

export async function getMangaDetail(id: string): Promise<AniListMedia> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        id idMal title { romaji english native }
        description(asHtml: false)
        coverImage { extraLarge large } bannerImage
        format status season seasonYear averageScore meanScore
        genres chapters volumes source
        externalLinks { id url site }
        characters(sort: ROLE, perPage: 25) {
          edges {
            role
            node {
              id name { full native }
              image { large medium }
            }
          }
        }
        staff(perPage: 15) {
          edges {
            role
            node {
              id name { full native }
              image { large medium }
            }
          }
        }
        relations {
          edges {
            relationType(version: 2)
            node {
              id idMal title { romaji english native }
              coverImage { large medium }
              type format status averageScore seasonYear
            }
          }
        }
        recommendations(perPage: 15, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id idMal title { romaji english native }
              coverImage { large medium }
              type format status averageScore seasonYear
            }
          }
        }
      }
    }
  `;
  const res = await queryAniList<AniListSingleResponse>(query, { id: parseInt(id) });
  return res.data.Media;
}

// ─── Recent Community Reviews ────────────────────────────────
export async function getRecentReviews(perPage = 3): Promise<any[]> {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        reviews(sort: ID_DESC) {
          id
          summary
          rating
          score
          user {
            name
            avatar { large }
          }
          media {
            title { english romaji }
          }
        }
      }
    }
  `;
  try {
    const res = await queryAniList<any>(query, { perPage });
    return res?.data?.Page?.reviews || [];
  } catch (err) {
    console.warn('getRecentReviews failed, falling back to Jikan:', err);
    try {
      const data = await fetchJikanFallback('/reviews/anime', { limit: perPage });
      return (data || []).slice(0, perPage).map((r: any, index: number) => ({
        id: r.mal_id || Math.floor(Math.random() * 1000000),
        summary: r.review ? (r.review.length > 200 ? r.review.substring(0, 180) + '...' : r.review) : 'Great series!',
        rating: r.score ? r.score : 8,
        score: r.score ? r.score * 10 : 80,
        createdAt: r.date ? Math.floor(new Date(r.date).getTime() / 1000) : Math.floor(Date.now() / 1000) - (index * 3600),
        user: {
          name: r.user?.username || 'MAL User',
          avatar: { large: r.user?.images?.jpg?.image_url || `https://api.dicebear.com/9.x/adventurer/svg?seed=${r.user?.username || index}` }
        },
        media: {
          title: {
            english: r.entry?.title || 'Anime Series',
            romaji: r.entry?.title || 'Anime Series'
          }
        }
      }));
    } catch (fallbackErr) {
      console.error('Jikan fallback for recent reviews failed:', fallbackErr);
      return [];
    }
  }
}
