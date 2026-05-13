// ═══════════════════════════════════════════════════════════════
// Jikan (MAL) API Response Types
// ═══════════════════════════════════════════════════════════════

export interface JikanAnime {
  mal_id: number;
  url: string;
  images: {
    jpg: { image_url: string; small_image_url: string; large_image_url: string };
    webp: { image_url: string; small_image_url: string; large_image_url: string };
  };
  trailer: {
    youtube_id: string | null;
    url: string | null;
    embed_url: string | null;
  };
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[];
  type: string;                  // TV | OVA | Movie | Special | ONA | Music
  source: string;
  episodes: number | null;
  status: string;                // "Finished Airing" | "Currently Airing" | "Not yet aired"
  airing: boolean;
  aired: {
    from: string | null;
    to: string | null;
  };
  duration: string;
  rating: string;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number;
  favorites: number;
  synopsis: string | null;
  background: string | null;
  season: string | null;
  year: number | null;
  broadcast: {
    day: string | null;
    time: string | null;
    timezone: string | null;
    string: string | null;
  };
  producers: JikanEntity[];
  licensors: JikanEntity[];
  studios: JikanEntity[];
  genres: JikanEntity[];
  themes: JikanEntity[];
  demographics: JikanEntity[];
}

export interface JikanEntity {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export interface JikanEpisode {
  mal_id: number;
  url: string;
  title: string;
  title_japanese: string | null;
  title_romanji: string | null;
  aired: string | null;
  score: number | null;
  filler: boolean;
  recap: boolean;
  forum_url: string | null;
}

export interface JikanEpisodeVideo {
  mal_id: number;
  title: string;
  episode: string;
  url: string;
  images: {
    jpg: { image_url: string };
  };
}

export interface JikanCharacter {
  character: {
    mal_id: number;
    name: string;
    images: { jpg: { image_url: string }; webp: { image_url: string } };
  };
  role: string;
  voice_actors: {
    person: { mal_id: number; name: string; images: { jpg: { image_url: string } } };
    language: string;
  }[];
}

export interface JikanStaff {
  person: {
    mal_id: number;
    name: string;
    images: { jpg: { image_url: string } };
  };
  positions: string[];
}

export interface JikanScheduleEntry {
  mal_id: number;
  title: string;
  images: {
    jpg: { image_url: string; large_image_url: string };
  };
  episodes: number | null;
  broadcast: {
    time: string | null;
    timezone: string | null;
  };
  url: string;
}

export interface JikanPaginatedResponse<T> {
  data: T[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: { count: number; total: number; per_page: number };
  };
}
