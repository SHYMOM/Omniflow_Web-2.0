// ═══════════════════════════════════════════════════════════════
// TMDB API Response Types
// ═══════════════════════════════════════════════════════════════

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: TMDBGenre[];
  runtime: number | null;
  status: string;
  tagline: string | null;
  original_language: string;
  origin_country: string[];
  production_companies?: TMDBCompany[];
  credits?: TMDBCredits;
  videos?: { results: TMDBVideo[] };
  similar?: TMDBListResponse<TMDBMovie>;
  recommendations?: TMDBListResponse<TMDBMovie>;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  genres?: TMDBGenre[];
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;                // "Returning Series" | "Ended" | "Canceled" | "In Production"
  tagline: string | null;
  original_language: string;
  origin_country: string[];
  production_companies?: TMDBCompany[];
  seasons?: TMDBSeason[];
  credits?: TMDBCredits;
  videos?: { results: TMDBVideo[] };
  similar?: TMDBListResponse<TMDBTVShow>;
  recommendations?: TMDBListResponse<TMDBTVShow>;
}

export interface TMDBSeason {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  episodes?: TMDBEpisode[];
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
  runtime: number | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;                  // "Trailer" | "Teaser" | "Clip" | "Featurette"
  official: boolean;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface TMDBListResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}
