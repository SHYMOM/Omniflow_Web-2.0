// ═══════════════════════════════════════════════════════════════
// Core Media Types — Unified across all API sources
// ═══════════════════════════════════════════════════════════════

export type MediaType = 'anime' | 'movie' | 'tv' | 'manga';
export type MediaSource = 'anilist' | 'tmdb' | 'mangaupdates' | 'jikan';
export type MediaStatus = 'RELEASING' | 'FINISHED' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';

export interface MediaItem {
  id: string;                    // Format: "anilist-21" / "tmdb-movie-927085" / "mu-12345"
  source: MediaSource;
  type: MediaType;
  title: string;                 // English preferred, fallback romaji
  nativeTitle?: string;
  posterUrl: string;             // Resolved full URL
  bannerUrl?: string;
  description: string;
  score: number;                 // Normalized 0-10 scale
  year: number;
  status: MediaStatus | string;
  format: string;                // "TV" | "ONA" | "MOVIE" | "MANGA" | "TV_SHORT" etc.
  formatLabel: string;           // Display label: "TV Show" | "ONA" | "Movie" etc.
  genres: string[];
  tags?: string[];
  episodeCount?: number;
  chapterCount?: number;
  volumeCount?: number;
  duration?: string;             // "24 min"
  season?: string;               // "FALL 1999"
  seasonYear?: number;
  trailerYoutubeId?: string;
  malId?: number;                // For embed URL building
  tmdbId?: number;               // For embed URL building
  anilistId?: number;
  studios?: string[];
  countryOfOrigin?: string;
  sourceMedia?: string;          // "MANGA" | "LIGHT_NOVEL" | "ORIGINAL" etc.
  nextAiringEpisode?: {
    airingAt: number;
    episode: number;
  };
  startDate?: { year: number; month: number; day: number };
  endDate?: { year: number; month: number; day: number };
  synonyms?: string[];
  hashtag?: string;
  meanScore?: number;
}

export interface WatchHistoryEntry {
  mediaId: string;
  mediaType: MediaType;
  mediaTitle: string;
  episodeTitle: string;
  episodeNumber: number;
  season?: number;
  thumbnailUrl: string;
  posterUrl: string;
  duration: number;              // total seconds
  watchedAt: string;             // ISO timestamp
  progress: number;              // 0-1 percentage
  malId?: number;
  tmdbId?: number;
  anilistId?: number;
}

export interface WatchlistEntry {
  mediaId: string;
  mediaType: MediaType;
  title: string;
  posterUrl: string;
  score: number;
  format: string;
  formatLabel: string;
  year: number;
  status: string;
  addedAt: string;               // ISO timestamp
  malId?: number;
  tmdbId?: number;
  anilistId?: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  mediaId: string;
  mediaTitle: string;
  episodeNumber?: number;
  episodeThumbnail?: string;
  content: string;
  createdAt: string;
  likes: number;
  dislikes: number;
}
