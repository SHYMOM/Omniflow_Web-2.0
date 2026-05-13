import axios from 'axios';
import type { AniListMedia, AniListPageResponse, AniListSingleResponse } from '@/types/anilist';

const ANILIST_PROXY = '/api/anilist';

/**
 * Execute an AniList GraphQL query via our server proxy
 */
async function queryAniList<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const { data } = await axios.post<T>(ANILIST_PROXY, { query, variables });
  return data;
}

// ─── Trending ────────────────────────────────────────────────
export async function getTrendingAnime(perPage = 8): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
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
  const res = await queryAniList<AniListPageResponse>(query, { perPage });
  return res.data.Page.media;
}

// ─── This Season ─────────────────────────────────────────────
export async function getThisSeasonAnime(perPage = 18): Promise<AniListMedia[]> {
  const now = new Date();
  const month = now.getMonth();
  const seasons = ['WINTER', 'WINTER', 'WINTER', 'SPRING', 'SPRING', 'SPRING', 'SUMMER', 'SUMMER', 'SUMMER', 'FALL', 'FALL', 'FALL'];
  const season = seasons[month];
  const year = now.getFullYear();

  const query = `
    query ($season: MediaSeason, $seasonYear: Int, $perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
          id idMal title { romaji english native }
          coverImage { extraLarge large }
          format status season seasonYear averageScore
        }
      }
    }`;
  const res = await queryAniList<AniListPageResponse>(query, { season, seasonYear: year, perPage });
  return res.data.Page.media;
}

// ─── All Time Popular ────────────────────────────────────────
export async function getPopularAnime(perPage = 18): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id idMal title { romaji english native }
          coverImage { extraLarge large }
          format status season seasonYear averageScore
        }
      }
    }`;
  const res = await queryAniList<AniListPageResponse>(query, { perPage });
  return res.data.Page.media;
}

// ─── Top Rated ───────────────────────────────────────────────
export async function getTopRatedAnime(perPage = 18): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, sort: SCORE_DESC) {
          id idMal title { romaji english native }
          coverImage { extraLarge large }
          format status season seasonYear averageScore
        }
      }
    }`;
  const res = await queryAniList<AniListPageResponse>(query, { perPage });
  return res.data.Page.media;
}

// ─── Upcoming ────────────────────────────────────────────────
export async function getUpcomingAnime(perPage = 6): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) {
          id idMal title { romaji english native }
          coverImage { extraLarge large } description(asHtml: false)
          source format genres
          startDate { year month day }
          studios(isMain: true) { nodes { name } }
        }
      }
    }`;
  const res = await queryAniList<AniListPageResponse>(query, { perPage });
  return res.data.Page.media;
}

// ─── Recently Updated ────────────────────────────────────────
export async function getRecentlyUpdatedAnime(perPage = 20): Promise<AniListMedia[]> {
  const query = `
    query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC) {
          id idMal title { romaji english native }
          coverImage { extraLarge large } bannerImage
          episodes format
          nextAiringEpisode { episode airingAt }
        }
      }
    }`;
  const res = await queryAniList<AniListPageResponse>(query, { perPage });
  return res.data.Page.media;
}

// ─── Full Detail ─────────────────────────────────────────────
export async function getAnimeDetail(id: number): Promise<AniListMedia> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id idMal title { romaji english native }
        description(asHtml: false)
        coverImage { extraLarge large } bannerImage
        trailer { id site }
        format status season seasonYear episodes duration
        averageScore meanScore popularity
        genres tags { name rank isMediaSpoiler }
        studios { nodes { id name isAnimationStudio } }
        characters(sort: ROLE, perPage: 12) {
          edges {
            role
            node { id name { full } image { large } }
            voiceActors(language: JAPANESE) { id name { full } image { large } languageV2 }
          }
        }
        staff(perPage: 8) {
          edges { role node { id name { full } image { large } } }
        }
        relations {
          edges {
            relationType
            node { id title { romaji english } coverImage { large } format type seasonYear status }
          }
        }
        recommendations(perPage: 15) {
          nodes {
            mediaRecommendation { id title { romaji english } coverImage { large } format type seasonYear }
          }
        }
        nextAiringEpisode { airingAt episode }
        source countryOfOrigin synonyms hashtag
        startDate { year month day } endDate { year month day }
      }
    }`;
  const res = await queryAniList<AniListSingleResponse>(query, { id });
  return res.data.Media;
}

// ─── Search ──────────────────────────────────────────────────
export async function searchAniList(
  searchQuery: string,
  type: 'ANIME' | 'MANGA' = 'ANIME',
  perPage = 20,
  page = 1
): Promise<{ media: AniListMedia[]; hasNextPage: boolean }> {
  const query = `
    query ($search: String, $type: MediaType, $perPage: Int, $page: Int) {
      Page(perPage: $perPage, page: $page) {
        pageInfo { hasNextPage currentPage lastPage }
        media(search: $search, type: $type, sort: SEARCH_MATCH) {
          id idMal title { romaji english native }
          coverImage { extraLarge large }
          format status season seasonYear averageScore
          genres episodes chapters
        }
      }
    }`;
  const res = await queryAniList<AniListPageResponse>(query, { search: searchQuery, type, perPage, page });
  return {
    media: res.data.Page.media,
    hasNextPage: res.data.Page.pageInfo.hasNextPage,
  };
}

// ─── Manga Detail ────────────────────────────────────────────
export async function getMangaDetail(id: number): Promise<AniListMedia> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        id idMal title { romaji english native }
        description(asHtml: false)
        coverImage { extraLarge large } bannerImage
        format status chapters volumes
        averageScore meanScore popularity
        genres tags { name rank isMediaSpoiler }
        characters(sort: ROLE, perPage: 12) {
          edges {
            role
            node { id name { full } image { large } }
          }
        }
        staff(perPage: 8) {
          edges { role node { id name { full } image { large } } }
        }
        relations {
          edges {
            relationType
            node { id title { romaji english } coverImage { large } format type seasonYear status }
          }
        }
        recommendations(perPage: 15) {
          nodes {
            mediaRecommendation { id title { romaji english } coverImage { large } format type seasonYear }
          }
        }
        source countryOfOrigin synonyms
        startDate { year month day } endDate { year month day }
      }
    }`;
  const res = await queryAniList<AniListSingleResponse>(query, { id });
  return res.data.Media;
}
