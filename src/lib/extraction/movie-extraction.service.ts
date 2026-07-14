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
import { MOVIES, DRAMA, StreamingServers } from '@/lib/consumet';
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

    // Multi-tier fallback strategy for title resolution
    const tryResolveTitle = async (): Promise<string | null> => {
      // Tier 1: Full TMDB API with all details
      try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await this.stealthClient.get(
          `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?append_to_response=alternative_titles&api_key=${TMDB_KEY}`,
          { timeout: 4000 }
        );

        const title = res.data?.title || res.data?.name || res.data?.original_title || '';
        if (title) return title;
      } catch {
        // Continue to tier 2
      }

      // Tier 2: Simple TMDB API call (faster, less likely to timeout)
      try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await this.stealthClient.get(
          `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}`,
          { timeout: 2000 }
        );

        const title = res.data?.title || res.data?.name || res.data?.original_title || '';
        if (title) return title;
      } catch {
        // Continue to tier 3
      }

      // Tier 3: Direct TMDB API call (server-side fallback)
      try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await fetch(
          `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}`,
          { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(3000) }
        );
        if (res.ok) {
          const data = await res.json();
          const title = data.title || data.name || data.original_title || '';
          if (title) return title;
        }
      } catch {
        // All tiers failed
      }

      return null;
    };

    const title = await tryResolveTitle();

    if (title) {
      // Also fetch release year if we got a title
      try {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await this.stealthClient.get(
          `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}`,
          { timeout: 2000 }
        );
        const dateStr = res.data?.release_date || res.data?.first_air_date;
        if (dateStr) {
          releaseYear = new Date(dateStr).getFullYear();
        }
      } catch {
        // Keep default releaseYear
      }
      return { title, releaseYear };
    }

    // Last resort: return TMDB ID as identifier, not "tmdb-movie-123"
    return { title: `TMDB ${mediaType} ${tmdbId}`, releaseYear };
  }

  // ─── Source Extraction ───────────────────────────────────────

  async extractSources(ctx: ExtractionContext, abortSignal?: AbortSignal): Promise<IStreamResult> {
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

    const isHindi = ctx.language === 'hin';
    const isEngDub = ctx.language === 'eng' || ctx.isDubbed;
    
    const cacheKey = `stream:movie:${tmdbId}:s${season}e${episode}:lang:${ctx.language || 'sub'}`;
    const cached = await getCachedStream(cacheKey);
    if (cached) return cached;

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
        priority: isHindi || isEngDub ? 0 : 5, // Bump priority if explicitly searching for a dub
        mediaTypes: ['movie', 'tv'],
        execute: () => {
          let searchTitle = title;
          if (isHindi) searchTitle += ' Hindi';
          else if (isEngDub) searchTitle += ' Dubbed';
          return this.extractFromMovieHdWatch(searchTitle, mediaType, episode, season);
        }
      },
      {
        name: 'cineby',
        priority: 6,
        mediaTypes: ['movie', 'tv'],
        execute: () => this.extractFromCineby(title, mediaType, episode, season),
      },
      {
        name: 'xprime',
        priority: 7,
        mediaTypes: ['movie', 'tv'],
        execute: () => this.extractFromXPrime(title, mediaType, episode, season),
      },
      {
        name: 'flixer',
        priority: 8,
        mediaTypes: ['movie', 'tv'],
        execute: () => this.extractFromFlixer(title, mediaType, episode, season),
      },
      {
        name: 'kisskh',
        priority: 9,
        mediaTypes: ['tv'],
        execute: () => this.extractFromKissKH(title, episode),
      },
      {
        name: 'asiaflix',
        priority: 10,
        mediaTypes: ['tv'],
        execute: () => this.extractFromAsiaFlix(title, episode),
      },
      {
        name: 'kdramasmaza',
        priority: 11,
        mediaTypes: ['tv'],
        execute: () => this.extractFromKDramasMaza(title, episode),
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

    const result = await this.registry.executeConcurrently(providers, abortSignal);

    if (result.success && result.data) {
      // Set default available languages immediately to avoid blocking the client
      result.data.availableLanguages = ['eng', 'hin'];

      // Perform language discovery in the background to update the cache asynchronously
      this.discoverAvailableLanguages(title).then(async (discoveredLangs) => {
        if (result.data) {
          result.data.availableLanguages = discoveredLangs;
          await setCachedStream(cacheKey, result.data, 10800);
        }
      }).catch(() => {});

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

  // ─── Parallel Language Discovery ─────────────────────────────

  private async discoverAvailableLanguages(title: string): Promise<string[]> {
    const langs = ['eng'];
    try {
      const mhdw = new MOVIES.MovieHdWatch();
      const probe = await mhdw.search(`${title} Hindi`);
      if (probe.results && probe.results.length > 0) {
        langs.push('hin');
      }
    } catch (e) {
      console.warn('[MovieExtraction] Language discovery probe failed:', e);
      return ['eng', 'hin']; // fallback
    }
    return langs;
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

  private async extractFromCineby(title: string, mediaType: 'movie' | 'tv', episode: number, season: number): Promise<IStreamResult> {
    const cb = new (MOVIES as any).Cineby();
    const searchRes = await cb.search(title);
    if (!searchRes.results?.length) throw new Error(`Cineby: No results`);

    const matched = searchRes.results.find((item: any) =>
      mediaType === 'movie' ? item.type === 'Movie' || item.type === 'MOVIE' : item.type === 'TV Series' || item.type === 'TVSERIES'
    ) || searchRes.results[0];

    const info = await cb.fetchMediaInfo(matched.id);
    const targetEp = mediaType === 'tv'
      ? info.episodes?.find((ep: any) => ep.season === season && ep.number === episode) || info.episodes?.[episode - 1]
      : info.episodes?.[0];
    if (!targetEp?.id) throw new Error(`Cineby: Episode not found`);

    const sources = await cb.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'cineby', 'https://cineby.app/');
  }

  private async extractFromXPrime(title: string, mediaType: 'movie' | 'tv', episode: number, season: number): Promise<IStreamResult> {
    const xp = new (MOVIES as any).XPrime();
    const searchRes = await xp.search(title);
    if (!searchRes.results?.length) throw new Error(`XPrime: No results`);

    const matched = searchRes.results.find((item: any) =>
      mediaType === 'movie' ? item.type === 'Movie' || item.type === 'MOVIE' : item.type === 'TV Series' || item.type === 'TVSERIES'
    ) || searchRes.results[0];

    const info = await xp.fetchMediaInfo(matched.id);
    const targetEp = mediaType === 'tv'
      ? info.episodes?.find((ep: any) => ep.season === season && ep.number === episode) || info.episodes?.[episode - 1]
      : info.episodes?.[0];
    if (!targetEp?.id) throw new Error(`XPrime: Episode not found`);

    const sources = await xp.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'xprime', 'https://xprime.to/');
  }

  private async extractFromFlixer(title: string, mediaType: 'movie' | 'tv', episode: number, season: number): Promise<IStreamResult> {
    const fl = new (MOVIES as any).Flixer();
    const searchRes = await fl.search(title);
    if (!searchRes.results?.length) throw new Error(`Flixer: No results`);

    const matched = searchRes.results.find((item: any) =>
      mediaType === 'movie' ? item.type === 'Movie' || item.type === 'MOVIE' : item.type === 'TV Series' || item.type === 'TVSERIES'
    ) || searchRes.results[0];

    const info = await fl.fetchMediaInfo(matched.id);
    const targetEp = mediaType === 'tv'
      ? info.episodes?.find((ep: any) => ep.season === season && ep.number === episode) || info.episodes?.[episode - 1]
      : info.episodes?.[0];
    if (!targetEp?.id) throw new Error(`Flixer: Episode not found`);

    const sources = await fl.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'flixer', 'https://flixer.com/');
  }

  private async extractFromKissKH(title: string, episode: number): Promise<IStreamResult> {
    const kh = new (DRAMA as any).KissKH();
    const searchRes = await kh.search(title);
    if (!searchRes.results?.length) throw new Error(`KissKH: No results`);

    const matched = searchRes.results[0];
    const info = await kh.fetchMediaInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`KissKH: Episode not found`);

    const sources = await kh.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'kisskh', 'https://kisskh.co/');
  }

  private async extractFromAsiaFlix(title: string, episode: number): Promise<IStreamResult> {
    const af = new (DRAMA as any).AsiaFlix();
    const searchRes = await af.search(title);
    if (!searchRes.results?.length) throw new Error(`AsiaFlix: No results`);

    const matched = searchRes.results[0];
    const info = await af.fetchMediaInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`AsiaFlix: Episode not found`);

    const sources = await af.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'asiaflix', 'https://asiaflix.app/');
  }

  private async extractFromKDramasMaza(title: string, episode: number): Promise<IStreamResult> {
    const km = new (DRAMA as any).KDramasMaza();
    const searchRes = await km.search(title);
    if (!searchRes.results?.length) throw new Error(`KDramasMaza: No results`);

    const matched = searchRes.results[0];
    const info = await km.fetchMediaInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`KDramasMaza: Episode not found`);

    const sources = await km.fetchEpisodeSources(targetEp.id, matched.id);
    return this.sanitizeSources(sources, 'kdramasmaza', 'https://kdramasmaza.net/');
  }
}
