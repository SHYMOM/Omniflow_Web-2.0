// ═══════════════════════════════════════════════════════════════
// Stealth HTTP Client — UA rotation, header spoofing, FlareSolverr
// ═══════════════════════════════════════════════════════════════

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { IStealthRequestConfig } from '@/types/extraction-types';
import {
  USER_AGENT_POOL,
  ACCEPT_LANGUAGE_POOL,
  FLARESOLVERR_URL,
  FLARESOLVERR_TIMEOUT_MS,
  PROVIDER_TIMEOUT_MS,
  MAX_RETRIES,
  RETRY_BASE_DELAY_MS,
} from './extraction-config';
import { RateLimiter } from './rate-limiter';

/**
 * Stealth HTTP client that wraps axios with:
 * - User-Agent rotation from a pool of real browser fingerprints
 * - Accept-Language header cycling
 * - Configurable Referer/Origin injection
 * - Optional FlareSolverr proxy for JS-challenge bypass
 * - Rate limiting via token bucket
 * - Exponential backoff retries
 */
export class StealthHttpClient {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private uaIndex = 0;
  private langIndex = 0;

  constructor() {
    this.rateLimiter = RateLimiter.getInstance();
    this.client = axios.create({
      timeout: PROVIDER_TIMEOUT_MS,
      validateStatus: (status) => status < 500,
    });

    // Request interceptor: inject stealth headers
    this.client.interceptors.request.use((config) => {
      if (!config.headers) {
        config.headers = {} as any;
      }

      const hasHeader = (name: string) => {
        const lowerName = name.toLowerCase();
        return Object.keys(config.headers || {}).some(k => k.toLowerCase() === lowerName);
      };

      // Rotate User-Agent
      if (!hasHeader('User-Agent')) {
        config.headers['User-Agent'] = this.getNextUA();
      }

      // Rotate Accept-Language
      if (!hasHeader('Accept-Language')) {
        config.headers['Accept-Language'] = this.getNextLang();
      }

      // Standard browser headers
      if (!hasHeader('Accept')) {
        config.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
      }

      if (!hasHeader('Accept-Encoding')) {
        config.headers['Accept-Encoding'] = 'gzip, deflate, br';
      }

      if (!hasHeader('Connection')) {
        config.headers['Connection'] = 'keep-alive';
      }

      if (!hasHeader('Sec-Fetch-Dest')) {
        config.headers['Sec-Fetch-Dest'] = 'document';
        config.headers['Sec-Fetch-Mode'] = 'navigate';
        config.headers['Sec-Fetch-Site'] = 'none';
        config.headers['Sec-Fetch-User'] = '?1';
      }

      return config;
    });
  }

  /**
   * Rotate through the UA pool round-robin.
   */
  private getNextUA(): string {
    const ua = USER_AGENT_POOL[this.uaIndex % USER_AGENT_POOL.length];
    this.uaIndex += 1;
    return ua;
  }

  /**
   * Rotate through the Accept-Language pool round-robin.
   */
  private getNextLang(): string {
    const lang = ACCEPT_LANGUAGE_POOL[this.langIndex % ACCEPT_LANGUAGE_POOL.length];
    this.langIndex += 1;
    return lang;
  }

  /**
   * Build axios config from our stealth request config.
   */
  private buildAxiosConfig(config: IStealthRequestConfig): AxiosRequestConfig {
    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method || 'GET',
      timeout: config.timeout || PROVIDER_TIMEOUT_MS,
      headers: { ...config.headers },
      data: config.data,
    };

    if (config.responseType) {
      axiosConfig.responseType = config.responseType;
    }

    // Inject Referer/Origin if specified
    if (config.referer) {
      axiosConfig.headers = axiosConfig.headers || {};
      (axiosConfig.headers as Record<string, string>)['Referer'] = config.referer;
      try {
        (axiosConfig.headers as Record<string, string>)['Origin'] = new URL(config.referer).origin;
      } catch { /* ignore malformed referer */ }
    }

    return axiosConfig;
  }

  /**
   * Execute a request via FlareSolverr (for JS-challenge-protected endpoints).
   */
  private async requestViaFlareSolverr(config: IStealthRequestConfig): Promise<AxiosResponse> {
    if (!FLARESOLVERR_URL) {
      throw new Error('FlareSolverr URL not configured');
    }

    await this.rateLimiter.waitForToken('flaresolverr');

    const payload: Record<string, unknown> = {
      cmd: 'request.get',
      url: config.url,
      maxTimeout: FLARESOLVERR_TIMEOUT_MS,
    };

    const response = await axios.post(FLARESOLVERR_URL, payload, {
      timeout: FLARESOLVERR_TIMEOUT_MS + 5000,
      headers: { 'Content-Type': 'application/json' },
    });

    // FlareSolverr wraps the response in its own format
    if (response.data?.solution) {
      return {
        data: response.data.solution.response,
        status: response.data.solution.status,
        statusText: 'OK',
        headers: response.data.solution.headers || {},
        config: {} as any,
      } as AxiosResponse;
    }

    throw new Error(`FlareSolverr failed: ${response.data?.message || 'Unknown error'}`);
  }

  /**
   * Main request method with rate limiting and retry logic.
   */
  async request<T = any>(config: IStealthRequestConfig): Promise<AxiosResponse<T>> {
    // Route through FlareSolverr if requested
    if (config.useFlareSolverr && FLARESOLVERR_URL) {
      return this.requestViaFlareSolverr(config) as Promise<AxiosResponse<T>>;
    }

    // Wait for rate limiter token
    await this.rateLimiter.waitForToken(config.url);

    const axiosConfig = this.buildAxiosConfig(config);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.request<T>(axiosConfig);

        // Treat 403/429 as retriable
        if (response.status === 403 || response.status === 429) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (err) {
        lastError = err as Error;

        // Don't retry on 4xx (except 403/429 already handled above)
        if (axios.isAxiosError(err) && err.response && err.response.status >= 400 && err.response.status < 500) {
          if (err.response.status !== 403 && err.response.status !== 429) {
            throw err;
          }
        }

        // Exponential backoff before retry
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          // Wait for another rate limiter token
          await this.rateLimiter.waitForToken(config.url);
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * Convenience GET method.
   */
  async get<T = any>(url: string, options?: Partial<IStealthRequestConfig>): Promise<AxiosResponse<T>> {
    return this.request<T>({ url, method: 'GET', ...options });
  }

  /**
   * Convenience POST method.
   */
  async post<T = any>(url: string, data?: unknown, options?: Partial<IStealthRequestConfig>): Promise<AxiosResponse<T>> {
    return this.request<T>({ url, method: 'POST', data, ...options });
  }

  /**
   * Get the raw axios instance (for Consumet providers that need an adapter).
   * Note: This bypasses stealth features — use sparingly.
   */
  getAxiosInstance(): AxiosInstance {
    return this.client;
  }
}
