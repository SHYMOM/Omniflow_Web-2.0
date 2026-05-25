// ═══════════════════════════════════════════════════════════════
// Movie/TV Extraction Service — Multi-provider cascading resolver
// ═══════════════════════════════════════════════════════════════
//
// Provider cascade: SmashyStream → MovieHdWatch → Vidnest (Playwright)
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
import { getCachedStream, setCachedStream } from '@/lib/cache/redis';
import { PlaywrightExtractor } from './playwright-extractor';
import { MovieboxExtractor } from './moviebox-extractor';

export class MovieExtractionService {
  private registry: ProviderRegistry;
  private stealthClient: StealthHttpClient;

  constructor() {
    this.registry = new ProviderRegistry();
    this.stealthClient = new StealthHttpClient();
  }

  // ─── Title Resolution ────────────────────────────────────────

  async resolveTitle(
    mediaId: string,
    mediaType: 'movie' | 'tv'
  ): Promise<{ title: string; releaseYear: number }> {
    const tmdbId = mediaId
      .replace('tmdb-movie-', '')
      .replace('tmdb-tv-', '');
    const TMDB_KEY = process.env.TMDB_API_KEY || '';

    let releaseYear = new Date().getFullYear();

    try {
      const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
      const res = await this.stealthClient.get(
        `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}`,
        { timeout: 4000 }
      );
      
      const title = res.data?.title || res.data?.name || res.data?.original_title || '';
      const dateStr = res.data?.release_date || res.data?.first_air_date;
      if (dateStr) {
        releaseYear = new Date(dateStr).getFullYear();
      }
      return { title, releaseYear };
    } catch (err) {
      console.warn('[MovieExtraction] TMDB title resolution failed:', err);
    }

    return { title: tmdbId, releaseYear };
  }

  // ─── Source Extraction ───────────────────────────────────────

  async extractSources(ctx: ExtractionContext): Promise<IStreamResult> {
    const mediaType = ctx.mediaType as 'movie' | 'tv';
    const tmdbId = ctx.mediaId
      .replace('tmdb-movie-', '')
      .replace('tmdb-tv-', '');

    const resolved = await this.resolveTitle(ctx.mediaId, mediaType);
    const title = ctx.title || resolved.title;
    const releaseYear = resolved.releaseYear;

    const episode = ctx.episode || 1;
    const season = ctx.season || 1;

    let seasonTmdbId = '';
    let episodeTmdbId = '';

    if (mediaType === 'tv') {
      try {
        const TMDB_KEY = process.env.TMDB_API_KEY || '';
        const epRes = await this.stealthClient.get(
          `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_KEY}`,
          { timeout: 3000 }
        );
        episodeTmdbId = String(epRes.data?.id || '');
        
        const seasonRes = await this.stealthClient.get(
          `https://api.themoviedb.org/3/tv/${tmdbId}/season/${season}?api_key=${TMDB_KEY}`,
          { timeout: 3000 }
        );
        seasonTmdbId = String(seasonRes.data?.id || '');
      } catch (e) {
        console.warn('[MovieExtraction] Failed to fetch season/episode TMDB IDs');
      }
    }

    const cacheKey = `stream:movie:${tmdbId}:s${season}e${episode}`;
    const cached = await getCachedStream(cacheKey);
    if (cached) return cached;

    const isHindi = ctx.language === 'hin';

    const providers: ProviderEntry<IStreamResult>[] = [
      {
        name: 'cinepro-core',
        priority: isHindi ? 1 : 0,
        mediaTypes: ['movie', 'tv'],
        execute: async () => {
          const { CineproAggregator } = await import('./cinepro-aggregator');
          const cinepro = new CineproAggregator();
          const { sources, subtitles } = mediaType === 'movie'
            ? await cinepro.scrapeMovie(tmdbId)
            : await cinepro.scrapeSeries(tmdbId, season, episode);

          if (sources.length > 0) {
            return {
              success: true,
              provider: 'cinepro-core',
              sources,
              subtitles,
              headers: {}
            };
          }
          throw new Error('CineproCore: No streams found');
        }
      },
      {
        name: 'stremio-addons',
        priority: isHindi ? 2 : 1,
        mediaTypes: ['movie', 'tv'],
        execute: async () => {
          const { StremioExtractor } = await import('./stremio-extractor');
          return new StremioExtractor().extractDirectStream(tmdbId, mediaType, episode, season);
        }
      },
      {
        name: 'moviebox',
        priority: isHindi ? 3 : 2,
        mediaTypes: ['movie', 'tv'],
        execute: () => new MovieboxExtractor().extractDirectStream(title, mediaType, episode, season),
      },
      {
        name: 'smashystream',
        priority: isHindi ? 0 : 4,
        mediaTypes: ['movie', 'tv'],
        execute: () => this.extractFromSmashyStream(tmdbId, mediaType, episode, season),
      },
      {
        name: 'moviehdwatch',
        priority: 5,
        mediaTypes: ['movie', 'tv'],
        execute: () => this.extractFromMovieHdWatch(title, mediaType, episode, season),
      },
    ];

    // UltimateAggregator removed as it depended on @movie-web/providers
    // and is now obsolete thanks to CineproAggregator.

    if (PLAYWRIGHT_ENABLED) {
      providers.push({
        name: 'playwright-interceptor',
        priority: 3,
        mediaTypes: ['movie', 'tv'],
        execute: () => new PlaywrightExtractor().extractDirectStream(tmdbId, mediaType, episode, season),
      });
    }

    const result = await this.registry.executeConcurrently(providers);

    if (result.success && result.data) {
      result.data.availableLanguages = ['eng', 'hin'];
      await setCachedStream(cacheKey, result.data, 10800); // 3 hours
      return result.data;
    }

    return {
      success: false,
      provider: 'none',
      sources: [],
      subtitles: [],
      headers: {},
    };
  }

  // ─── Provider Implementations ────────────────────────────────

  private async extractFromSmashyStream(
    tmdbId: string,
    mediaType: 'movie' | 'tv',
    episode: number,
    season: number
  ): Promise<IStreamResult> {
    const smashy = new MOVIES.SmashyStream();
    const isTv = mediaType === 'tv';
    
    const sources = await smashy.fetchEpisodeSources(
      tmdbId, 
      isTv ? season : undefined, 
      isTv ? episode : undefined
    );
    
    return this.sanitizeSources(sources, 'smashystream', 'https://embed.smashystream.com/');
  }

  private async extractFromMovieHdWatch(
    title: string,
    mediaType: 'movie' | 'tv',
    episode: number,
    season: number
  ): Promise<IStreamResult> {
    const mhdw = new MOVIES.MovieHdWatch();
    const searchRes = await mhdw.search(title);

    if (!searchRes.results?.length) throw new Error(`MovieHdWatch: No results for "${title}"`);

    const matched = searchRes.results.find((item: any) =>
      mediaType === 'movie' ? item.type === 'Movie' || item.type === 'MOVIE' : item.type === 'TV Series' || item.type === 'TVSERIES'
    ) || searchRes.results[0];

    if (!matched?.id) throw new Error(`MovieHdWatch: No matching media`);

    const info = await mhdw.fetchMediaInfo(matched.id);
    if (!info.episodes?.length) throw new Error(`MovieHdWatch: No episodes`);

    const targetEp = mediaType === 'movie'
      ? info.episodes[0]
      : info.episodes.find((ep: any) => ep.season === season && ep.number === episode) || info.episodes[episode - 1];

    if (!targetEp?.id) throw new Error(`MovieHdWatch: Episode not found`);

    const serverCascade = [StreamingServers.VidCloud, StreamingServers.MixDrop, StreamingServers.UpCloud];

    for (const server of serverCascade) {
      try {
        const sources = await mhdw.fetchEpisodeSources(targetEp.id, matched.id, server);
        return this.sanitizeSources(sources, 'moviehdwatch', 'https://movieshd.watch/');
      } catch (err) { }
    }

    throw new Error('MovieHdWatch: All servers exhausted');
  }

  // ─── Utilities ──────────────────────────────────────────────

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

    return {
      success: sources.length > 0,
      provider: providerName,
      sources,
      subtitles,
      headers: { Referer: rawSources.headers?.Referer || defaultReferer },
    };
  }
}
