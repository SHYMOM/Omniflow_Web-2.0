// ═══════════════════════════════════════════════════════════════
// Extraction Engine — Configuration Constants
// ═══════════════════════════════════════════════════════════════

import type { IRateLimitConfig, ICircuitBreakerConfig } from '@/types/extraction-types';

// ─── Timeouts ────────────────────────────────────────────────

/** Max time (ms) to wait for a single provider extraction attempt */
export const PROVIDER_TIMEOUT_MS = 22000;

/** Max retries per provider before moving to next in cascade */
export const MAX_RETRIES = 2;

/** Delay between retries (ms) — doubles on each retry (exponential backoff) */
export const RETRY_BASE_DELAY_MS = 500;

// ─── Circuit Breaker ─────────────────────────────────────────

export const CIRCUIT_BREAKER_CONFIG: ICircuitBreakerConfig = {
  failureThreshold: 3,        // Open after 3 consecutive failures
  cooldownMs: 30_000,         // Wait 30s before transitioning to HALF_OPEN
  halfOpenMaxAttempts: 1,     // Allow 1 probe request in HALF_OPEN
};

// ─── Rate Limits (per domain) ────────────────────────────────

export const RATE_LIMITS: Record<string, IRateLimitConfig> = {
  'api.jikan.moe':        { maxRequests: 3,  windowMs: 1000 },
  'api.mangadex.org':     { maxRequests: 5,  windowMs: 1000 },
  'graphql.anilist.co':   { maxRequests: 10, windowMs: 1000 },
  'hianime.to':           { maxRequests: 2,  windowMs: 1000 },
  'anineko.to':           { maxRequests: 2,  windowMs: 1000 },
  'flixhq.to':            { maxRequests: 2,  windowMs: 1000 },
  'fmovies.to':           { maxRequests: 2,  windowMs: 1000 },
  'megacloud.tv':         { maxRequests: 3,  windowMs: 1000 },
  'vidsrc.to':            { maxRequests: 2,  windowMs: 1000 },
  'asuracomic.net':       { maxRequests: 2,  windowMs: 1000 },
  'mangapill.com':        { maxRequests: 2,  windowMs: 1000 },
  // FlareSolverr is expensive — limit heavily
  'flaresolverr':         { maxRequests: 1,  windowMs: 2000 },
};

/** Default rate limit for unlisted domains */
export const DEFAULT_RATE_LIMIT: IRateLimitConfig = {
  maxRequests: 5,
  windowMs: 1000,
};

// ─── FlareSolverr ────────────────────────────────────────────

/** URL of local FlareSolverr instance (optional) */
export const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || null;

/** Timeout for FlareSolverr requests (they're slow due to browser spin-up) */
export const FLARESOLVERR_TIMEOUT_MS = 30_000;

// ─── Playwright ──────────────────────────────────────────────

/** Whether Playwright headless interception is enabled */
export const PLAYWRIGHT_ENABLED = process.env.PLAYWRIGHT_ENABLED === 'true';

/** Timeout for Playwright page load + network interception */
export const PLAYWRIGHT_TIMEOUT_MS = 18_000;

// ─── User Agent Pool ─────────────────────────────────────────

export const USER_AGENT_POOL: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 OPR/108.0.0.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

// ─── Accept-Language Pool ────────────────────────────────────

export const ACCEPT_LANGUAGE_POOL: string[] = [
  'en-US,en;q=0.9',
  'en-US,en;q=0.9,ja;q=0.8',
  'en-GB,en;q=0.9,en-US;q=0.8',
  'en-US,en;q=0.9,es;q=0.8',
  'en,en-US;q=0.9',
];

// ─── Provider Priority Mapping ───────────────────────────────

export const ANIME_PROVIDER_ORDER = ['zoro', 'gogoanime', '9anime'] as const;
export const MOVIE_PROVIDER_ORDER = ['smashystream', 'moviehdwatch', 'vidsrc'] as const;
export const MANGA_PROVIDER_ORDER = ['mangadex', 'asurascans', 'mangapill'] as const;
