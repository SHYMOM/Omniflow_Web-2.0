// ═══════════════════════════════════════════════════════════════
// Provider Registry — Cascade execution engine with health tracking
// ═══════════════════════════════════════════════════════════════

import type { IProviderResult, IProviderHealth } from '@/types/extraction-types';
import type { MediaType } from '@/types/media';
import { CircuitBreaker } from './circuit-breaker';
import { PROVIDER_TIMEOUT_MS } from './extraction-config';

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
 * Usage:
 *   const registry = new ProviderRegistry();
 *   const result = await registry.executeWithCascade<IStreamResult>([
 *     { name: 'zoro', priority: 0, mediaTypes: ['anime'], execute: () => zoroExtract() },
 *     { name: 'gogoanime', priority: 1, mediaTypes: ['anime'], execute: () => gogoExtract() },
 *   ]);
 */
export class ProviderRegistry {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = CircuitBreaker.getInstance();
  }

  /**
   * Execute all providers concurrently using a Promise.any approach.
   * First successful stream wins the race, providing extreme speed like MovieBox.
   */
  async executeConcurrently<T>(
    providers: ProviderEntry<T>[]
  ): Promise<IProviderResult<T>> {
    const promises = providers.map(async (provider) => {
      // Check circuit breaker
      if (!this.circuitBreaker.isAvailable(provider.name)) {
        console.warn(`[ProviderRegistry] Skipping ${provider.name} — circuit OPEN`);
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
        
        // Basic check for extraction result validity
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
        throw new Error(`${provider.name}: ${errorMsg}`);
      }
    });

    try {
      // Return the FIRST successful resolved promise
      const winner = await Promise.any(promises);
      return winner;
    } catch (aggregateError) {
      // If ALL providers fail
      return {
        success: false,
        provider: 'none',
        error: 'All providers failed concurrently',
        latencyMs: 0,
      };
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
