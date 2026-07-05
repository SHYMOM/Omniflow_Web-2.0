// ═══════════════════════════════════════════════════════════════
// Provider Registry — Cascade execution engine with health tracking
// ═══════════════════════════════════════════════════════════════

import type { IProviderResult, IProviderHealth } from '@/types/extraction-types';
import type { MediaType } from '@/types/media';
import { CircuitBreaker } from './circuit-breaker';
import { PROVIDER_TIMEOUT_MS } from './extraction-config';
import { logger } from '../logger';

export interface ProviderEntry<T = unknown> {
  name: string;
  priority: number;                // Lower = higher priority
  mediaTypes: MediaType[];
  execute: () => Promise<T>;
}

/**
 * Central registry that manages provider execution priority,
 * health tracking, and cascading fallback logic.
 *
 * Uses TRUE concurrent execution: all providers fire at T=0 and
 * the first one to return a valid result wins immediately,
 * regardless of priority tier. Tiers are ignored for resolution
 * speed — they only affect circuit breaker ordering.
 */
export class ProviderRegistry {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = CircuitBreaker.getInstance();
  }

  /**
   * Execute ALL providers concurrently via Promise.any.
   * First successful result wins — no tier barriers.
   * Each provider has a hard per-provider timeout.
   */
  async executeConcurrently<T>(
    providers: ProviderEntry<T>[]
  ): Promise<IProviderResult<T>> {
    const overallStartTime = Date.now();

    // If no providers, fail fast
    if (providers.length === 0) {
      return {
        success: false,
        provider: 'none',
        error: 'No providers registered',
        latencyMs: 0,
      };
    }

    // Fire ALL providers at T=0 — true concurrency, no tier blocking
    const promises = providers.map((provider) =>
      this.executeSingle(provider)
    );

    // Promise.any: first success wins immediately
    // If all fail, catch and return failure
    try {
      const winner = await Promise.any(promises);
      console.log(`[ProviderRegistry] 🏎️ Race won by ${winner.provider} in ${Date.now() - overallStartTime}ms`);
      return winner;
    } catch {
      console.error(`[ProviderRegistry] ✗ All ${providers.length} providers failed in ${Date.now() - overallStartTime}ms`);
      return {
        success: false,
        provider: 'none',
        error: 'All providers failed',
        latencyMs: Date.now() - overallStartTime,
      };
    }
  }

  private async executeSingle<T>(
    provider: ProviderEntry<T>
  ): Promise<IProviderResult<T>> {
    if (!this.circuitBreaker.isAvailable(provider.name)) {
      throw new Error(`Circuit OPEN for ${provider.name}`);
    }

    if (this.circuitBreaker.getState(provider.name) === 'HALF_OPEN') {
      this.circuitBreaker.recordProbeAttempt(provider.name);
    }

    const startTime = Date.now();
    try {
      const result = await Promise.race([
        provider.execute(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Provider ${provider.name} timed out`)), PROVIDER_TIMEOUT_MS)
        ),
      ]);

      const latencyMs = Date.now() - startTime;

      if ((result as any)?.success === false) {
        throw new Error(`${provider.name} returned success: false`);
      }

      this.circuitBreaker.recordSuccess(provider.name);
      console.log(`[ProviderRegistry] ✓ ${provider.name} succeeded in ${latencyMs}ms`);

      return {
        success: true,
        provider: provider.name,
        data: result,
        latencyMs,
      } as IProviderResult<T>;
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.circuitBreaker.recordFailure(provider.name);
      console.warn(`[ProviderRegistry] ✗ ${provider.name} failed in ${latencyMs}ms: ${errorMsg}`);
      logger.error('ProviderRegistry', `Provider ${provider.name} failed`, err);
      throw new Error(`${provider.name}: ${errorMsg}`);
    }
  }

  /**
   * Get health report across all tracked providers.
   */
  getHealthReport(): IProviderHealth[] {
    return this.circuitBreaker.getHealthReport().map((entry) => ({
      provider: entry.provider,
      status:
        entry.state === 'CLOSED'
          ? 'healthy'
          : entry.state === 'HALF_OPEN'
            ? 'degraded'
            : 'down',
      lastSuccess: entry.lastSuccess,
      lastFailure: entry.lastFailure,
      consecutiveFailures: entry.consecutiveFailures,
      circuitState: entry.state,
    }));
  }

  /**
   * Force-reset a specific provider's circuit breaker.
   */
  resetProvider(name: string): void {
    this.circuitBreaker.resetProvider(name);
  }
}
