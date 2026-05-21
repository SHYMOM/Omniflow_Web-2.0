// ═══════════════════════════════════════════════════════════════
// Token Bucket Rate Limiter — Per-domain request throttling
// ═══════════════════════════════════════════════════════════════

import type { IRateLimitConfig } from '@/types/extraction-types';
import { RATE_LIMITS, DEFAULT_RATE_LIMIT } from './extraction-config';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  config: IRateLimitConfig;
}

/**
 * In-memory token bucket rate limiter.
 * Each domain gets its own bucket configured via RATE_LIMITS.
 * Singleton — call RateLimiter.getInstance().
 */
export class RateLimiter {
  private static instance: RateLimiter;
  private buckets: Map<string, TokenBucket> = new Map();

  private constructor() {}

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Extract domain from a URL string for bucket lookup.
   */
  private extractDomain(urlOrDomain: string): string {
    try {
      if (urlOrDomain.startsWith('http')) {
        return new URL(urlOrDomain).hostname;
      }
      return urlOrDomain;
    } catch {
      return urlOrDomain;
    }
  }

  /**
   * Get or create a token bucket for the given domain.
   */
  private getBucket(domain: string): TokenBucket {
    let bucket = this.buckets.get(domain);
    if (!bucket) {
      const config = RATE_LIMITS[domain] || DEFAULT_RATE_LIMIT;
      bucket = {
        tokens: config.maxRequests,
        lastRefill: Date.now(),
        config,
      };
      this.buckets.set(domain, bucket);
    }
    return bucket;
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   */
  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillAmount = (elapsed / bucket.config.windowMs) * bucket.config.maxRequests;
    bucket.tokens = Math.min(bucket.config.maxRequests, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  /**
   * Attempt to consume a token. Returns true if allowed, false if throttled.
   */
  tryConsume(urlOrDomain: string): boolean {
    const domain = this.extractDomain(urlOrDomain);
    const bucket = this.getBucket(domain);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /**
   * Wait until a token becomes available, then consume it.
   * Returns the wait time in ms (0 if immediately available).
   */
  async waitForToken(urlOrDomain: string): Promise<number> {
    const domain = this.extractDomain(urlOrDomain);
    const bucket = this.getBucket(domain);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return 0;
    }

    // Calculate wait time until next token refill
    const tokensNeeded = 1 - bucket.tokens;
    const waitMs = Math.ceil((tokensNeeded / bucket.config.maxRequests) * bucket.config.windowMs);

    await new Promise(resolve => setTimeout(resolve, waitMs));

    // Re-refill after waiting
    this.refill(bucket);
    bucket.tokens = Math.max(0, bucket.tokens - 1);
    return waitMs;
  }

  /**
   * Get current token count for a domain (for diagnostics).
   */
  getTokenCount(urlOrDomain: string): number {
    const domain = this.extractDomain(urlOrDomain);
    const bucket = this.getBucket(domain);
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Reset all buckets (useful for testing).
   */
  reset(): void {
    this.buckets.clear();
  }
}
