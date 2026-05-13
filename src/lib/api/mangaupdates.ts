import axios from 'axios';

const MU_PROXY = '/api/mangaupdates';

export interface MUSeriesResult {
  series_id: number;
  title: string;
  url: string;
  description: string;
  image: { url: { original: string } };
  type: string;
  year: string;
  bayesian_rating: number;
  rating: number;
  genres: { genre: string }[];
  categories: { category: string; votes: number }[];
  authors: { name: string; type: string }[];
  publishers: { publisher_name: string; type: string }[];
  status: string;
  completed: boolean;
  last_updated: { timestamp: number };
}

// ─── Search ──────────────────────────────────────────────────
export async function searchMangaUpdates(query: string, page = 1): Promise<{ results: MUSeriesResult[]; total: number }> {
  const { data } = await axios.post(`${MU_PROXY}/search`, {
    search: query,
    page,
    perpage: 20,
  });
  return { results: data.results || [], total: data.total_hits || 0 };
}

// ─── Series Detail ───────────────────────────────────────────
export async function getMangaUpdatesDetail(seriesId: number): Promise<MUSeriesResult> {
  const { data } = await axios.get(`${MU_PROXY}/series/${seriesId}`);
  return data;
}
