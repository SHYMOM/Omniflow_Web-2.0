// ═══════════════════════════════════════════════════════════════
// Movie/TV Extraction Service — Multi-provider cascading resolver
// ═══════════════════════════════════════════════════════════════
//
// Provider cascade: FlixHQ → VidSrc (Playwright) → FMovies → Goku
// TMDB ID → title resolution → provider search → episode match → source extraction.
// Playwright is loaded conditionally to avoid bloating installs.
//

import type {
  ExtractionContext,
  IStreamResult,
  IStreamSource,
  IStreamSubtitle,
} from '@/types/extraction-types';
import { MOVIES, StreamingServers } from '@/lib/consumet';
import { ProviderRegistry, type ProviderEntry } from './provider-registry';
import { StealthHttpClient } from './stealth-client';
import { PLAYWRIGHT_ENABLED, PLAYWRIGHT_TIMEOUT_MS } from './extraction-config';

/**
 * Service responsible for extracting playable stream sources from movie/TV providers.
 *
 * Flow:
 *   1. resolveTitle(tmdbId, type) — get title from TMDB API
 *   2. extractSources(ctx) — cascade through providers
 */
export class MovieExtractionService {
  private registry: ProviderRegistry;
  private stealthClient: StealthHttpClient;

  constructor() {
    this.registry = new ProviderRegistry();
    this.stealthClient = new StealthHttpClient();
  }

  // ─── Title Resolution ────────────────────────────────────────

  /**
   * Resolve movie/TV title from TMDB ID.
   */
  async resolveTitle(
    mediaId: string,
    mediaType: 'movie' | 'tv'
  ): Promise<string> {
    const tmdbId = mediaId
      .replace('tmdb-movie-', '')
      .replace('tmdb-tv-', '');
    const TMDB_KEY = process.env.TMDB_API_KEY || '';

    try {
      const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
      const res = await this.stealthClient.get(
        `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}`,
        { timeout: 4000 }
      );
      return res.data?.title || res.data?.name || res.data?.original_title || '';
    } catch (err) {
      console.warn('[MovieExtraction] TMDB title resolution failed:', err);
    }

    return tmdbId;
  }

  // ─── Source Extraction ───────────────────────────────────────

  /**
   * Extract stream sources using multi-provider cascade.
   * Order: FlixHQ → VidSrc (headless) → FMovies → Goku → iframe fallback
   */
  async extractSources(ctx: ExtractionContext): Promise<IStreamResult> {
    const mediaType = ctx.mediaType as 'movie' | 'tv';
    const title = ctx.title || await this.resolveTitle(ctx.mediaId, mediaType);
    const episode = ctx.episode || 1;
    const season = ctx.season || 1;

    // Extract raw TMDB ID for VidSrc URL construction
    const tmdbId = ctx.mediaId
      .replace('tmdb-movie-', '')
      .replace('tmdb-tv-', '');

    // Build provider cascade
    const providers: ProviderEntry<IStreamResult>[] = [
      {
        name: 'flixhq',
        priority: 0,
        mediaTypes: ['movie', 'tv'],
        execute: () => this.extractFromFlixHQ(title, mediaType, episode, season),
      },
    ];

    // VidSrc via Playwright (priority 1 — only if Playwright is enabled)
    if (PLAYWRIGHT_ENABLED) {
      providers.push({
        name: 'vidsrc',
        priority: 1,
        mediaTypes: ['movie', 'tv'],
        execute: () => this.extractFromVidSrc(tmdbId, mediaType, episode, season),
      });
    }

    // FMovies (priority 2)
    providers.push({
      name: 'fmovies',
      priority: 2,
      mediaTypes: ['movie', 'tv'],
      execute: () => this.extractFromFMovies(title, mediaType, episode, season),
    });

    // Goku (priority 3)
    providers.push({
      name: 'goku',
      priority: 3,
      mediaTypes: ['movie', 'tv'],
      execute: () => this.extractFromGoku(title, mediaType, episode, season),
    });

    const result = await this.registry.executeWithCascade(providers);

    if (result.success && result.data) {
      return result.data;
    }

    // All providers failed — return VidSrc iframe URL as fallback
    const iframeUrl = this.constructVidSrcUrl(tmdbId, mediaType, episode, season);
    return {
      success: false,
      provider: 'iframe-fallback',
      sources: [],
      subtitles: [],
      headers: {},
      iframeUrl,
    };
  }

  // ─── VidSrc URL Construction ────────────────────────────────

  /**
   * Construct VidSrc embed URL from TMDB ID.
   * For movies:  https://vidsrc.to/embed/movie/{tmdbId}
   * For TV:      https://vidsrc.to/embed/tv/{tmdbId}/{season}/{episode}
   */
  private constructVidSrcUrl(
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    episode: number,
    season: number
  ): string {
    if (mediaType === 'movie') {
      return `https://vidsrc.to/embed/movie/${tmdbId}`;
    }
    return `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;
  }

  // ═══════════════════════════════════════════════════════════
  // PROVIDER IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════

  // ─── FlixHQ Provider ───────────────────────────────────────

  private async extractFromFlixHQ(
    title: string,
    mediaType: 'movie' | 'tv',
    episode: number,
    season: number
  ): Promise<IStreamResult> {
    const flixhq = new MOVIES.FlixHQ();
    const searchRes = await flixhq.search(title);

    if (!searchRes.results?.length) {
      throw new Error(`FlixHQ: No results for "${title}"`);
    }

    // Match by type
    const matched = searchRes.results.find((item: any) =>
      mediaType === 'movie' ? item.type === 'movie' : item.type === 'tv'
    ) || searchRes.results[0];

    if (!matched?.id) {
      throw new Error(`FlixHQ: No matching media found for "${title}"`);
    }

    const info = await flixhq.fetchMediaInfo(matched.id);
    if (!info.episodes?.length) {
      throw new Error(`FlixHQ: No episodes found for "${matched.id}"`);
    }

    // Find target episode
    const targetEp = mediaType === 'movie'
      ? info.episodes[0]
      : info.episodes.find((ep: any) => ep.season === season && ep.number === episode);

    if (!targetEp?.id) {
      throw new Error(`FlixHQ: Episode S${season}E${episode} not found`);
    }

    // Server cascade: UpCloud → VidCloud → MixDrop
    const serverCascade = [
      StreamingServers.UpCloud,
      StreamingServers.VidCloud,
      StreamingServers.MixDrop,
    ];

    for (const server of serverCascade) {
      try {
        const sources = await flixhq.fetchEpisodeSources(targetEp.id, matched.id, server);
        return this.sanitizeSources(sources, 'flixhq', 'https://flixhq.to/');
      } catch (err) {
        console.warn(`[MovieExtraction] FlixHQ server ${server} failed:`, err);
      }
    }

    throw new Error('FlixHQ: All servers exhausted');
  }

  // ─── VidSrc via Playwright ─────────────────────────────────

  /**
   * Headless browser interception of VidSrc embed.
   * Loads the embed URL in Playwright, intercepts XHR/fetch requests
   * to capture the final .m3u8 payload.
   *
   * Playwright is loaded dynamically to keep it optional.
   */
  private async extractFromVidSrc(
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    episode: number,
    season: number
  ): Promise<IStreamResult> {
    // Dynamic import — Playwright is only loaded when actually needed
    let playwright: any;
    try {
      playwright = await import('playwright');
    } catch {
      throw new Error('VidSrc: Playwright is not installed. Run: npx playwright install chromium');
    }

    const embedUrl = this.constructVidSrcUrl(tmdbId, mediaType, episode, season);

    let browser: any = null;
    try {
      browser = await playwright.chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      // Collect intercepted stream URLs
      const interceptedUrls: { url: string; type: string }[] = [];
      const interceptedSubtitles: IStreamSubtitle[] = [];

      // Intercept network requests to capture .m3u8 and .vtt payloads
      page.on('response', async (response: any) => {
        const url = response.url();

        // Capture .m3u8 master playlists
        if (url.includes('.m3u8') || url.includes('master.m3u8')) {
          interceptedUrls.push({ url, type: 'hls' });
        }

        // Capture subtitle tracks
        if (url.includes('.vtt') || url.includes('.srt')) {
          interceptedSubtitles.push({
            url,
            lang: 'en',
            label: 'English',
            default: true,
          });
        }

        // Capture API responses that might contain source URLs
        if (url.includes('/getSources') || url.includes('/source') || url.includes('/playlist')) {
          try {
            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('json')) {
              const body = await response.json();
              this.extractUrlsFromApiResponse(body, interceptedUrls, interceptedSubtitles);
            }
          } catch { /* ignore parse errors */ }
        }
      });

      // Navigate to embed URL
      await page.goto(embedUrl, {
        waitUntil: 'networkidle',
        timeout: PLAYWRIGHT_TIMEOUT_MS,
      });

      // Wait a bit for dynamic requests to complete
      await page.waitForTimeout(3000);

      // Try clicking play button if present
      try {
        await page.click('button.play, .play-btn, [class*="play"]', { timeout: 2000 });
        await page.waitForTimeout(2000);
      } catch { /* no play button — might autoplay */ }

      await browser.close();
      browser = null;

      if (interceptedUrls.length === 0) {
        throw new Error('VidSrc: No .m3u8 URLs intercepted');
      }

      // Prefer master playlist
      const masterUrl = interceptedUrls.find(u => u.url.includes('master'))
        || interceptedUrls[0];

      const sources: IStreamSource[] = interceptedUrls.map(u => ({
        url: u.url,
        quality: u.url.includes('master') ? 'auto' : 'default',
        isM3U8: true,
      }));

      return {
        success: true,
        provider: 'vidsrc',
        sources,
        subtitles: interceptedSubtitles,
        headers: {
          Referer: 'https://vidsrc.to/',
          Origin: 'https://vidsrc.to',
        },
      };
    } catch (err) {
      if (browser) {
        try { await browser.close(); } catch { /* ignore */ }
      }
      throw err;
    }
  }

  /**
   * Extract stream URLs from JSON API responses intercepted during Playwright navigation.
   */
  private extractUrlsFromApiResponse(
    body: any,
    urls: { url: string; type: string }[],
    subtitles: IStreamSubtitle[]
  ): void {
    if (!body) return;

    // Handle common source response formats
    const sources = body.sources || body.source || body.data?.sources;
    if (Array.isArray(sources)) {
      for (const s of sources) {
        const url = s.url || s.file || s.src;
        if (url && (url.includes('.m3u8') || url.includes('playlist'))) {
          urls.push({ url, type: 'hls' });
        }
      }
    } else if (typeof sources === 'string' && sources.includes('.m3u8')) {
      urls.push({ url: sources, type: 'hls' });
    }

    // Handle subtitle tracks
    const tracks = body.tracks || body.subtitles || body.data?.tracks;
    if (Array.isArray(tracks)) {
      for (const t of tracks) {
        const url = t.url || t.file || t.src;
        if (url && (url.includes('.vtt') || url.includes('.srt'))) {
          subtitles.push({
            url,
            lang: t.lang?.substring(0, 2) || 'en',
            label: t.label || t.lang || 'English',
            default: t.default || false,
          });
        }
      }
    }
  }

  // ─── FMovies Provider ──────────────────────────────────────

  private async extractFromFMovies(
    title: string,
    mediaType: 'movie' | 'tv',
    episode: number,
    season: number
  ): Promise<IStreamResult> {
    const fmovies = new MOVIES.Fmovies();
    const searchRes = await fmovies.search(title);

    if (!searchRes.results?.length) {
      throw new Error(`FMovies: No results for "${title}"`);
    }

    const matched = searchRes.results[0];
    if (!matched?.id) {
      throw new Error(`FMovies: No matching media found for "${title}"`);
    }

    const info = await fmovies.fetchMediaInfo(matched.id);
    if (!info.episodes?.length) {
      throw new Error(`FMovies: No episodes found`);
    }

    const targetEp = mediaType === 'movie'
      ? info.episodes[0]
      : info.episodes.find((ep: any) => ep.season === season && ep.number === episode)
        || info.episodes[episode - 1];

    if (!targetEp?.id) {
      throw new Error(`FMovies: Episode not found`);
    }

    const sources = await fmovies.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'fmovies', 'https://fmovies.to/');
  }

  // ─── Goku Provider ────────────────────────────────────────

  private async extractFromGoku(
    title: string,
    mediaType: 'movie' | 'tv',
    episode: number,
    season: number
  ): Promise<IStreamResult> {
    const goku = new MOVIES.Goku();
    const searchRes = await goku.search(title);

    if (!searchRes.results?.length) {
      throw new Error(`Goku: No results for "${title}"`);
    }

    const matched = searchRes.results[0];
    if (!matched?.id) {
      throw new Error(`Goku: No matching media found for "${title}"`);
    }

    const info = await goku.fetchMediaInfo(matched.id);
    if (!info.episodes?.length) {
      throw new Error(`Goku: No episodes found`);
    }

    const targetEp = mediaType === 'movie'
      ? info.episodes[0]
      : info.episodes.find((ep: any) => ep.season === season && ep.number === episode)
        || info.episodes[episode - 1];

    if (!targetEp?.id) {
      throw new Error(`Goku: Episode not found`);
    }

    const sources = await goku.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'goku', 'https://goku.sx/');
  }

  // ─── Utilities ──────────────────────────────────────────────

  /**
   * Normalize Consumet source output to our unified IStreamResult interface.
   */
  private sanitizeSources(
    rawSources: any,
    providerName: string,
    defaultReferer: string
  ): IStreamResult {
    const sources: IStreamSource[] = (rawSources.sources || []).map((s: any) => ({
      url: s.url,
      quality: s.quality || (s.isM3U8 ? 'auto' : 'default'),
      isM3U8: Boolean(s.isM3U8),
    }));

    const subtitles: IStreamSubtitle[] = (rawSources.subtitles || []).map((s: any) => ({
      url: s.url,
      lang: s.lang?.toLowerCase().substring(0, 2) || 'en',
      label: s.lang || 'English',
      default: s.lang?.toLowerCase() === 'english' || s.lang?.toLowerCase() === 'en',
    }));

    const headers: Record<string, string> = {
      Referer: rawSources.headers?.Referer || rawSources.headers?.referer || defaultReferer,
    };

    return {
      success: sources.length > 0,
      provider: providerName,
      sources,
      subtitles,
      headers,
      download: rawSources.download || undefined,
    };
  }
}
