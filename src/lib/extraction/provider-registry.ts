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
   * Execute providers in priority order with circuit-breaker gating.
   * Returns the first successful result, or the last error.
   */
  async executeWithCascade<T>(
    providers: ProviderEntry<T>[]
  ): Promise<IProviderResult<T>> {
    // Sort by priority (ascending — lower number = higher priority)
    const sorted = [...providers].sort((a, b) => a.priority - b.priority);

    let lastError: string = 'No providers available';
    let totalLatency = 0;

    for (const provider of sorted) {
      // Check circuit breaker
      if (!this.circuitBreaker.isAvailable(provider.name)) {
        console.warn(`[ProviderRegistry] Skipping ${provider.name} — circuit OPEN`);
        continue;
      }

      // Record probe attempt if HALF_OPEN
      if (this.circuitBreaker.getState(provider.name) === 'HALF_OPEN') {
        this.circuitBreaker.recordProbeAttempt(provider.name);
      }

      const startTime = Date.now();

      try {
        // Race the provider against a timeout
        const result = await Promise.race([
          provider.execute(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Provider ${provider.name} timed out`)), PROVIDER_TIMEOUT_MS)
          ),
        ]);

        const latencyMs = Date.now() - startTime;
        totalLatency += latencyMs;

        // Record success
        this.circuitBreaker.recordSuccess(provider.name);

        console.log(`[ProviderRegistry] ✓ ${provider.name} succeeded in ${latencyMs}ms`);

        return {
          success: true,
          provider: provider.name,
          data: result,
          latencyMs,
        };
      } catch (err) {
        const latencyMs = Date.now() - startTime;
        totalLatency += latencyMs;
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Record failure
        this.circuitBreaker.recordFailure(provider.name);

        console.warn(
          `[ProviderRegistry] ✗ ${provider.name} failed in ${latencyMs}ms: ${errorMsg}`
        );

        lastError = `${provider.name}: ${errorMsg}`;
      }
    }

    // All providers failed
    return {
      success: false,
      provider: 'none',
      error: lastError,
      latencyMs: totalLatency,
    };
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
