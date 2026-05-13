import axios from 'axios';
import type { TMDBMovie, TMDBTVShow, TMDBSeason, TMDBListResponse } from '@/types/tmdb';

const TMDB_PROXY = '/api/tmdb';

// ─── Trending ────────────────────────────────────────────────
export async function getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBMovie[]> {
  const { data } = await axios.get<TMDBListResponse<TMDBMovie>>(
    `${TMDB_PROXY}/trending`, { params: { type: 'movie', timeWindow } }
  );
  return data.results;
}

export async function getTrendingTV(timeWindow: 'day' | 'week' = 'week'): Promise<TMDBTVShow[]> {
  const { data } = await axios.get<TMDBListResponse<TMDBTVShow>>(
    `${TMDB_PROXY}/trending`, { params: { type: 'tv', timeWindow } }
  );
  return data.results;
}

// ─── Details ─────────────────────────────────────────────────
export async function getMovieDetails(id: number): Promise<TMDBMovie> {
  const { data } = await axios.get<TMDBMovie>(`${TMDB_PROXY}/movie/${id}`);
  return data;
}

export async function getTVDetails(id: number): Promise<TMDBTVShow> {
  const { data } = await axios.get<TMDBTVShow>(`${TMDB_PROXY}/tv/${id}`);
  return data;
}

export async function getTVSeasonEpisodes(tvId: number, seasonNumber: number): Promise<TMDBSeason> {
  const { data } = await axios.get<TMDBSeason>(`${TMDB_PROXY}/tv/${tvId}/season/${seasonNumber}`);
  return data;
}

// ─── Search ──────────────────────────────────────────────────
export async function searchTMDB(
  query: string,
  type: 'movie' | 'tv' | 'multi' = 'multi',
  page = 1
): Promise<TMDBListResponse<TMDBMovie | TMDBTVShow>> {
  const { data } = await axios.get(`${TMDB_PROXY}/search`, { params: { q: query, type, page } });
  return data;
}

// ─── Videos / Trailers ───────────────────────────────────────
export async function getMovieTrailerKey(id: number): Promise<string | null> {
  const { data } = await axios.get<{ results: { key: string; site: string; type: string }[] }>(
    `${TMDB_PROXY}/movie/${id}/videos`
  );
  const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
  return trailer?.key || data.results.find(v => v.site === 'YouTube')?.key || null;
}
