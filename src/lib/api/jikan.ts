import axios from 'axios';
import type { JikanAnime, JikanEpisode, JikanEpisodeVideo, JikanCharacter, JikanStaff, JikanScheduleEntry, JikanPaginatedResponse } from '@/types/jikan';

const JIKAN_PROXY = '/api/jikan';

// Rate limit: 400ms between calls
let lastCallTime = 0;
async function rateLimitedFetch<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const now = Date.now();
  const waitTime = Math.max(0, 400 - (now - lastCallTime));
  if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));
  lastCallTime = Date.now();
  const { data } = await axios.get<T>(url, { params });
  return data;
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
