// ═══════════════════════════════════════════════════════════════
// Extraction Engine — Barrel Exports
// ═══════════════════════════════════════════════════════════════

// ─── Services ────────────────────────────────────────────────
export { AnimeExtractionService } from './anime-extraction.service';
export { MangaExtractionService } from './manga-extraction.service';
export { MovieExtractionService } from './movie-extraction.service';

// ─── Infrastructure ──────────────────────────────────────────
export { StealthHttpClient } from './stealth-client';
export { ProviderRegistry } from './provider-registry';
export { CircuitBreaker } from './circuit-breaker';
export { RateLimiter } from './rate-limiter';

// ─── Configuration ───────────────────────────────────────────
export {
  PROVIDER_TIMEOUT_MS,
  MAX_RETRIES,
  CIRCUIT_BREAKER_CONFIG,
  RATE_LIMITS,
  ANIME_PROVIDER_ORDER,
  MOVIE_PROVIDER_ORDER,
  MANGA_PROVIDER_ORDER,
  PLAYWRIGHT_ENABLED,
} from './extraction-config';

// ─── Types (re-export for convenience) ───────────────────────
export type {
  IStreamResult,
  IStreamSource,
  IStreamSubtitle,
  IStreamMarker,
  IMangaPage,
  IMangaPageResult,
  IMangaChapterEntry,
  IMangaChapterListResult,
  ExtractionContext,
  IProviderResult,
  IProviderHealth,
} from '@/types/extraction-types';
