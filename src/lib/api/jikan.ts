import axios from 'axios';
import type { JikanAnime, JikanEpisode, JikanEpisodeVideo, JikanCharacter, JikanStaff, JikanScheduleEntry, JikanPaginatedResponse } from '@/types/jikan';

const JIKAN_PROXY = '/api/jikan';

let jikanFetchQueue: Promise<any> = Promise.resolve();

async function rateLimitedFetch<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const result = jikanFetchQueue.then(async () => {
    // Spacing delay to honor Jikan rate limits (max 3 req/sec)
    await new Promise(r => setTimeout(r, 500));

    const endpoint = url.replace('/api/jikan', '');

    // Direct client-side fetch (zero CORS, extremely fast)
    if (typeof window !== 'undefined') {
      try {
        const queryStr = params ? '?' + new URLSearchParams(params as any).toString() : '';
        const res = await window.fetch(`https://api.jikan.moe/v4${endpoint}${queryStr}`);
        if (res.ok) {
          return await res.json() as T;
        }
      } catch (e) {
        console.warn('Direct Jikan window fetch failed, trying proxy...', e);
      }

      // Client-side fallback to local proxy route
      const { data } = await axios.get<T>(url, { params });
      return data;
    }

    // Server-side direct fetch using Axios (avoids relative path protocol issues and native fetch WAF blocks)
    try {
      const { data } = await axios.get<T>(`https://api.jikan.moe/v4${endpoint}`, {
        params,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
      });
      return data;
    } catch (e: any) {
      console.warn(`Server-side direct Jikan fetch failed for ${endpoint}: ` + (e?.message || e));
      throw e;
    }
  });

  // Advance the queue pointer so next requests wait for this one
  jikanFetchQueue = result.catch(() => {});

  return result;
}

// ─── Top Anime ───────────────────────────────────────────────
export async function getTopAnime(filter?: string, page = 1): Promise<JikanPaginatedResponse<JikanAnime>> {
  return rateLimitedFetch<JikanPaginatedResponse<JikanAnime>>(
    `${JIKAN_PROXY}/top`, { type: 'anime', filter, page }
  );
}

// ─── Anime Detail ────────────────────────────────────────────
export async function getAnimeDetailJikan(malId: number): Promise<JikanAnime> {
  const res = await rateLimitedFetch<{ data: JikanAnime }>(`${JIKAN_PROXY}/anime/${malId}`);
  return res.data;
}

// ─── Episodes ────────────────────────────────────────────────
export async function getAnimeEpisodes(malId: number, page = 1): Promise<JikanPaginatedResponse<JikanEpisode>> {
  return rateLimitedFetch<JikanPaginatedResponse<JikanEpisode>>(
    `${JIKAN_PROXY}/anime/${malId}/episodes`, { page }
  );
}

// ─── Episode Videos (for thumbnails) ─────────────────────────
export async function getAnimeEpisodeVideos(malId: number, page = 1): Promise<JikanPaginatedResponse<JikanEpisodeVideo>> {
  return rateLimitedFetch<JikanPaginatedResponse<JikanEpisodeVideo>>(
    `${JIKAN_PROXY}/anime/${malId}/episodes/videos`, { page }
  );
}

// ─── Characters ──────────────────────────────────────────────
export async function getAnimeCharacters(malId: number): Promise<JikanCharacter[]> {
  const res = await rateLimitedFetch<{ data: JikanCharacter[] }>(
    `${JIKAN_PROXY}/anime/${malId}/characters`
  );
  return res.data;
}

// ─── Staff ───────────────────────────────────────────────────
export async function getAnimeStaff(malId: number): Promise<JikanStaff[]> {
  const res = await rateLimitedFetch<{ data: JikanStaff[] }>(
    `${JIKAN_PROXY}/anime/${malId}/staff`
  );
  return res.data;
}

// ─── Schedule ────────────────────────────────────────────────
export async function getSchedule(day?: string): Promise<JikanScheduleEntry[]> {
  const res = await rateLimitedFetch<{ data: JikanScheduleEntry[] }>(
    `${JIKAN_PROXY}/schedules`, { day }
  );
  return res.data;
}

// ─── Search ──────────────────────────────────────────────────
export async function searchJikan(query: string, type = 'anime', page = 1): Promise<JikanPaginatedResponse<JikanAnime>> {
  return rateLimitedFetch<JikanPaginatedResponse<JikanAnime>>(
    `${JIKAN_PROXY}/search`, { q: query, type, page }
  );
}
