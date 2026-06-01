// ═══════════════════════════════════════════════════════════════
// Extraction Pipeline Types — Unified contracts for all providers
// ═══════════════════════════════════════════════════════════════

import type { MediaType } from './media';

// ─── Stream Extraction ───────────────────────────────────────

export interface IStreamSource {
  url: string;
  quality: string;       // 'auto' | '1080p' | '720p' | '480p' | '360p' | 'default'
  isM3U8: boolean;
  referer?: string;
  provider?: any;
}

export interface IStreamSubtitle {
  url: string;
  lang: string;          // ISO 639-1 code: 'en', 'ja', 'es'
  label: string;         // Display label: 'English', 'Japanese'
  default?: boolean;
}

export interface IStreamMarker {
  start: number;         // seconds
  end: number;           // seconds
}

export interface IStreamResult {
  success: boolean;
  provider: string;      // Which provider resolved this
  sources: IStreamSource[];
  subtitles: IStreamSubtitle[];
  headers: Record<string, string>;
  intro?: IStreamMarker;
  outro?: IStreamMarker;
  download?: string;
  iframeUrl?: string;    // Fallback embed URL when direct extraction fails
  availableLanguages?: string[]; // Discovered languages ('sub', 'dub', etc.)
  audioTracks?: Array<{ language: string; label: string; default?: boolean }>;
}

// ─── Manga Page Extraction ───────────────────────────────────

export interface IMangaPage {
  url: string;
  page: number;
  width?: number;
  height?: number;
}

export interface IMangaPageResult {
  success: boolean;
  provider: string;
  pages: IMangaPage[];
  headers: Record<string, string>;
}

export interface IMangaChapterEntry {
  id: string;
  title: string;
  chapterNumber: string;
  volumeNumber?: string;
  pages?: number;
  scanlationGroup?: string;
  publishedAt?: string;
}

export interface IMangaChapterListResult {
  success: boolean;
  provider: string;
  chapters: IMangaChapterEntry[];
  totalChapters: number;
}

// ─── Provider System ─────────────────────────────────────────

export enum ProviderPriority {
  PRIMARY = 0,
  SECONDARY = 1,
  TERTIARY = 2,
  FALLBACK = 3,
}

export interface ExtractionContext {
  mediaId: string;         // Canonical ID: 'anilist-21', 'tmdb-movie-550'
  title: string;           // Resolved title for search
  episode?: number;
  season?: number;
  mediaType: MediaType;
  isDubbed?: boolean;      // For anime sub/dub preference
  language?: string;       // Preferred language: 'sub', 'eng', 'hin'
}

export interface IProviderResult<T> {
  success: boolean;
  provider: string;
  data?: T;
  error?: string;
  latencyMs: number;
}

export interface IProviderHealth {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  lastSuccess: number | null;      // Unix timestamp
  lastFailure: number | null;
  consecutiveFailures: number;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

// ─── Stealth & Networking ────────────────────────────────────

export interface IRateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface IStealthRequestConfig {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  data?: unknown;
  timeout?: number;
  referer?: string;
  useFlareSolverr?: boolean;
  responseType?: 'json' | 'text' | 'stream' | 'arraybuffer';
}

export interface ICircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxAttempts: number;
}
