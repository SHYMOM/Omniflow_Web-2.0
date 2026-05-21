// ═══════════════════════════════════════════════════════════════
// Circuit Breaker — Per-provider failure isolation
// ═══════════════════════════════════════════════════════════════

import type { ICircuitBreakerConfig } from '@/types/extraction-types';
import { CIRCUIT_BREAKER_CONFIG } from './extraction-config';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitEntry {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  halfOpenAttempts: number;
}

/**
 * Per-provider circuit breaker to prevent cascading failures.
 *
 * State transitions:
 *   CLOSED ──(failures >= threshold)──► OPEN
 *   OPEN ──(cooldown elapsed)──► HALF_OPEN
 *   HALF_OPEN ──(success)──► CLOSED
 *   HALF_OPEN ──(failure)──► OPEN
 *
 * Singleton — call CircuitBreaker.getInstance().
 */
export class CircuitBreaker {
  private static instance: CircuitBreaker;
  private circuits: Map<string, CircuitEntry> = new Map();
  private config: ICircuitBreakerConfig;

  private constructor(config?: ICircuitBreakerConfig) {
    this.config = config || CIRCUIT_BREAKER_CONFIG;
  }

  static getInstance(config?: ICircuitBreakerConfig): CircuitBreaker {
    if (!CircuitBreaker.instance) {
      CircuitBreaker.instance = new CircuitBreaker(config);
    }
    return CircuitBreaker.instance;
  }

  /**
   * Get or create a circuit entry for the given provider.
   */
  private getCircuit(provider: string): CircuitEntry {
    let circuit = this.circuits.get(provider);
    if (!circuit) {
      circuit = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        halfOpenAttempts: 0,
      };
      this.circuits.set(provider, circuit);
    }
    return circuit;
  }

  /**
   * Check if the circuit should transition from OPEN to HALF_OPEN
   * (cooldown period has elapsed).
   */
  private checkTransition(circuit: CircuitEntry): void {
    if (circuit.state === 'OPEN' && circuit.lastFailureTime) {
      const elapsed = Date.now() - circuit.lastFailureTime;
      if (elapsed >= this.config.cooldownMs) {
        circuit.state = 'HALF_OPEN';
        circuit.halfOpenAttempts = 0;
      }
    }
  }

  /**
   * Returns true if the provider is available for requests.
   * CLOSED and HALF_OPEN allow requests; OPEN blocks them.
   */
  isAvailable(provider: string): boolean {
    const circuit = this.getCircuit(provider);
    this.checkTransition(circuit);

    switch (circuit.state) {
      case 'CLOSED':
        return true;
      case 'HALF_OPEN':
        return circuit.halfOpenAttempts < this.config.halfOpenMaxAttempts;
      case 'OPEN':
        return false;
    }
  }

  /**
   * Record a successful request. Resets failure count and closes circuit.
   */
  recordSuccess(provider: string): void {
    const circuit = this.getCircuit(provider);
    circuit.consecutiveFailures = 0;
    circuit.lastSuccessTime = Date.now();
    circuit.state = 'CLOSED';
    circuit.halfOpenAttempts = 0;
  }

  /**
   * Record a failed request. May open the circuit if threshold exceeded.
   */
  recordFailure(provider: string): void {
    const circuit = this.getCircuit(provider);
    circuit.consecutiveFailures += 1;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === 'HALF_OPEN') {
      // Probe failed — immediately reopen
      circuit.state = 'OPEN';
      circuit.halfOpenAttempts = 0;
      return;
    }

    if (circuit.consecutiveFailures >= this.config.failureThreshold) {
      circuit.state = 'OPEN';
    }
  }

  /**
   * Mark a HALF_OPEN probe attempt (called before actually making the request).
   */
  recordProbeAttempt(provider: string): void {
    const circuit = this.getCircuit(provider);
    if (circuit.state === 'HALF_OPEN') {
      circuit.halfOpenAttempts += 1;
    }
  }

  /**
   * Get the current state of a provider's circuit.
   */
  getState(provider: string): CircuitState {
    const circuit = this.getCircuit(provider);
    this.checkTransition(circuit);
    return circuit.state;
  }

  /**
   * Get health report for all known providers.
   */
  getHealthReport(): Array<{
    provider: string;
    state: CircuitState;
    consecutiveFailures: number;
    lastSuccess: number | null;
    lastFailure: number | null;
  }> {
    const report: Array<{
      provider: string;
      state: CircuitState;
      consecutiveFailures: number;
      lastSuccess: number | null;
      lastFailure: number | null;
    }> = [];

    for (const [provider, circuit] of this.circuits) {
      this.checkTransition(circuit);
      report.push({
        provider,
        state: circuit.state,
        consecutiveFailures: circuit.consecutiveFailures,
        lastSuccess: circuit.lastSuccessTime,
        lastFailure: circuit.lastFailureTime,
      });
    }
    return report;
  }

  /**
   * Reset a specific provider's circuit to CLOSED.
   */
  resetProvider(provider: string): void {
    this.circuits.delete(provider);
  }

  /**
   * Reset all circuits.
   */
  resetAll(): void {
    this.circuits.clear();
  }
}
