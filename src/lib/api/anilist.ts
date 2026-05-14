import axios from 'axios';
import type { AniListMedia, AniListPageResponse, AniListSingleResponse } from '@/types/anilist';

const ANILIST_PROXY = '/api/anilist';

/**
 * Execute an AniList GraphQL query via our server proxy
 */
export async function queryAniList<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { data } = await axios.post<T>(ANILIST_PROXY, { query, variables });
  return data;
}

// ─── Trending ────────────────────────────────────────────────
export async function getTrendingAnime(perPage = 8, page = 1, hideAdult = true): Promise<AniListMedia[]> {
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
}

// ─── Popular This Season ─────────────────────────────────────
export async function getThisSeasonAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
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
}

// ─── Popular All Time ────────────────────────────────────────
export async function getPopularAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
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
}

// ─── Top Rated ───────────────────────────────────────────────
export async function getTopRatedAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
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
}

// ─── Top Upcoming ────────────────────────────────────────────
export async function getTopUpcomingAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
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
}

// ─── Recently Updated ────────────────────────────────────────
export async function getRecentlyUpdatedAnime(perPage = 18, page = 1, hideAdult = true): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int, $page: Int, $hideAdult: Boolean) {
      Page(perPage: $perPage, page: $page) {
        media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC, isAdult: $hideAdult) {
          id idMal title { romaji english native }
          coverImage { extraLarge large } bannerImage
          episodes format
          nextAiringEpisode { episode airingAt }
        }
      }
    }
  `;
  const res = await queryAniList<AniListPageResponse>(query, { perPage, page, hideAdult: hideAdult ? false : undefined });
  return res.data.Page.media;
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
  const res = await queryAniList<AniListSingleResponse>(query, { id: parseInt(id) });
  return res.data.Media;
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
  const res = await queryAniList<AniListSingleResponse>(query, { idMal: parseInt(idMal) });
  return res.data.Media;
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

export async function getAiringSchedule(start: number, end: number): Promise<AniListMedia[]> {
  const query = `
    query ($start: Int, $end: Int) {
      Page(perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_less: $end) {
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
