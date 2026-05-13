// ═══════════════════════════════════════════════════════════════
// AniList GraphQL Response Types
// ═══════════════════════════════════════════════════════════════

export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  description: string | null;
  coverImage: {
    extraLarge: string;
    large: string;
  };
  bannerImage: string | null;
  trailer: {
    id: string;
    site: string;
  } | null;
  format: string;               // TV | TV_SHORT | MOVIE | SPECIAL | OVA | ONA | MUSIC | MANGA | NOVEL | ONE_SHOT
  type: 'ANIME' | 'MANGA';
  status: string;                // RELEASING | FINISHED | NOT_YET_RELEASED | CANCELLED | HIATUS
  season: string | null;         // WINTER | SPRING | SUMMER | FALL
  seasonYear: number | null;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  duration: number | null;       // minutes per episode
  averageScore: number | null;   // 0-100
  meanScore: number | null;      // 0-100
  popularity: number;
  trending: number | null;
  genres: string[];
  tags: AniListTag[];
  studios: {
    nodes: AniListStudio[];
  };
  characters: {
    edges: AniListCharacterEdge[];
  };
  staff: {
    edges: AniListStaffEdge[];
  };
  relations: {
    edges: AniListRelationEdge[];
  };
  recommendations: {
    nodes: AniListRecommendation[];
  };
  nextAiringEpisode: {
    airingAt: number;
    episode: number;
  } | null;
  source: string | null;         // ORIGINAL | MANGA | LIGHT_NOVEL | VISUAL_NOVEL etc.
  countryOfOrigin: string | null;
  synonyms: string[];
  hashtag: string | null;
  startDate: AniListDate;
  endDate: AniListDate;
  updatedAt: number | null;
}

export interface AniListDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListTag {
  name: string;
  rank: number;
  isMediaSpoiler: boolean;
}

export interface AniListStudio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export interface AniListCharacterEdge {
  role: 'MAIN' | 'SUPPORTING' | 'BACKGROUND';
  node: {
    id: number;
    name: { full: string };
    image: { large: string };
  };
  voiceActors: {
    id: number;
    name: { full: string };
    image: { large: string };
    languageV2: string;
  }[];
}

export interface AniListStaffEdge {
  role: string;
  node: {
    id: number;
    name: { full: string };
    image: { large: string };
  };
}

export interface AniListRelationEdge {
  relationType: string;          // PREQUEL | SEQUEL | SIDE_STORY | SPIN_OFF | ALTERNATIVE | CHARACTER | SUMMARY | OTHER
  node: {
    id: number;
    title: { romaji: string; english: string | null };
    coverImage: { large: string };
    format: string;
    type: 'ANIME' | 'MANGA';
    seasonYear: number | null;
    status: string;
  };
}

export interface AniListRecommendation {
  mediaRecommendation: {
    id: number;
    title: { romaji: string; english: string | null };
    coverImage: { large: string };
    format: string;
    type: 'ANIME' | 'MANGA';
    seasonYear: number | null;
  } | null;
}

export interface AniListPageResponse {
  data: {
    Page: {
      pageInfo: {
        total: number;
        currentPage: number;
        lastPage: number;
        hasNextPage: boolean;
      };
      media: AniListMedia[];
    };
  };
}

export interface AniListSingleResponse {
  data: {
    Media: AniListMedia;
  };
}
