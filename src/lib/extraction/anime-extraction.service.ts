// ═══════════════════════════════════════════════════════════════
// Anime Extraction Service — Multi-provider cascading resolver
// ═══════════════════════════════════════════════════════════════

import type {
  ExtractionContext,
  IStreamResult,
  IStreamSource,
  IStreamSubtitle,
} from '@/types/extraction-types';
import { ANIME, StreamingServers } from '@/lib/consumet';
import { ProviderRegistry, type ProviderEntry } from './provider-registry';
import { StealthHttpClient } from './stealth-client';
import { getCachedStream, setCachedStream } from '@/lib/cache/redis';
import { PLAYWRIGHT_ENABLED } from './extraction-config';
import { UltimateAggregator } from './ultimate-aggregator';
import { MovieboxExtractor } from './moviebox-extractor';
import { StremioExtractor } from './stremio-extractor';

export class AnimeExtractionService {
  private registry: ProviderRegistry;
  private stealthClient: StealthHttpClient;

  constructor() {
    this.registry = new ProviderRegistry();
    this.stealthClient = new StealthHttpClient();
  }

  // ─── Title Resolution ────────────────────────────────────────

  async resolveTitle(mediaId: string): Promise<string> {
    const cleanId = mediaId.replace('anilist-', '').replace('mal-', '').replace('jikan-', '');
    const isMAL = mediaId.includes('mal') || mediaId.includes('jikan');
    const variables = isMAL ? { idMal: Number(cleanId) } : { id: Number(cleanId) };

    try {
      const query = `query ($id: Int, $idMal: Int) { Media(id: $id, idMal: $idMal, type: ANIME) { title { english romaji } } }`;
      const res = await this.stealthClient.post('https://graphql.anilist.co', { query, variables }, { timeout: 4000 });
      const title = res.data?.data?.Media?.title?.english || res.data?.data?.Media?.title?.romaji;
      if (title) return title;
    } catch (err) {}

    return cleanId.replace(/-/g, ' ');
  }

  // ─── Source Extraction & Caching ─────────────────────────────

  async extractSources(ctx: ExtractionContext): Promise<IStreamResult> {
    const title = ctx.title || await this.resolveTitle(ctx.mediaId);
    const episode = ctx.episode || 1;
    const isDub = ctx.isDubbed || ctx.language === 'eng' || ctx.language === 'dub';

    const cacheKey = `stream:anime:${ctx.mediaId}:ep${episode}:${isDub ? 'dub' : 'sub'}`;
    const cached = await getCachedStream(cacheKey);
    if (cached) return cached;

    // Build providers
    const providers: ProviderEntry<IStreamResult>[] = [
      {
        name: 'cinepro-core',
        priority: 0,
        mediaTypes: ['anime'],
        execute: async () => {
          const { CineproAggregator } = await import('./cinepro-aggregator');
          const cinepro = new CineproAggregator();
          // Assuming anime uses TMDB ID logic via Anitlist ID mapping, but for now we might need to fallback.
          // Since cinepro requires TMDB ID, and anime has anilist, we should pass it properly. 
          // For now, if we don't have TMDB ID in anime context, cinepro might fail. We'll pass the title as tmdbId to gracefully fail or work.
          // We'll update the Aggregator to handle this.
          const { sources, subtitles } = await cinepro.scrapeSeries(ctx.mediaId, 1, episode);
          
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
        name: 'stremio-extractor',
        priority: 1,
        mediaTypes: ['anime'],
        execute: () => new StremioExtractor().extractDirectStream(ctx.mediaId, 'anime', episode, 1),
      },
      {
        name: 'moviebox',
        priority: 2,
        mediaTypes: ['anime'],
        execute: () => new MovieboxExtractor().extractDirectStream(title, 'tv', episode, 1),
      },
      {
        name: 'zoro',
        priority: 3,
        mediaTypes: ['anime'],
        execute: () => this.extractFromZoro(title, episode, isDub),
      },
      {
        name: 'gogoanime',
        priority: 4,
        mediaTypes: ['anime'],
        execute: () => this.extractFromGogoanime(title, episode, isDub),
      },
      {
        name: 'animepahe',
        priority: 5,
        mediaTypes: ['anime'],
        execute: () => this.extractFromAnimePahe(title, episode, isDub),
      }
    ];

    // UltimateAggregator removed.

    if (PLAYWRIGHT_ENABLED) {
      const { PlaywrightExtractor } = await import('./playwright-extractor');
      providers.push({
        name: 'playwright-interceptor',
        priority: 6,
        mediaTypes: ['anime'],
        execute: () => new PlaywrightExtractor().extractDirectStream(ctx.mediaId.replace('anilist-', ''), 'anime', episode, 1, isDub),
      });
    }

    const result = await this.registry.executeConcurrently(providers);

    if (result.success && result.data) {
      // Run parallel check to determine availableLanguages
      result.data.availableLanguages = await this.determineAvailableLanguages(title, episode, isDub, result.data.provider);
      await setCachedStream(cacheKey, result.data, 10800);
      return result.data;
    }

    return { success: false, provider: 'none', sources: [], subtitles: [], headers: {} };
  }

  // ─── Parallel Language Discovery ─────────────────────────────

  private async determineAvailableLanguages(title: string, episode: number, currentIsDub: boolean, provider: string): Promise<string[]> {
    const langs = [currentIsDub ? 'dub' : 'sub'];
    const otherIsDub = !currentIsDub;
    
    // Quick parallel check for the other language on the same successful provider
    try {
      if (provider === 'gogoanime') {
        const gogo = new ANIME.Gogoanime();
        const dubSuffix = '(Dub)';
        const searchQuery = otherIsDub ? `${title} ${dubSuffix}` : title;
        const res = await gogo.search(searchQuery);
        if (res.results?.length) langs.push(otherIsDub ? 'dub' : 'sub');
      } else if (provider === 'zoro') {
        const zoro = new ANIME.Zoro();
        const res = await zoro.search(title);
        if (res.results?.length && res.results[0].id) {
           const info = await zoro.fetchAnimeInfo(res.results[0].id);
           if (info.episodes && info.episodes.length >= episode) langs.push(otherIsDub ? 'dub' : 'sub'); // Zoro often has dual audio if it has the episode
        }
      }
    } catch (err) { }
    
    return [...new Set(langs)];
  }

  // ─── Provider Implementations ────────────────────────────────

  private async extractFromZoro(title: string, episode: number, isDub: boolean): Promise<IStreamResult> {
    const zoro = new ANIME.Zoro();
    const searchRes = await zoro.search(title);
    if (!searchRes.results?.length) throw new Error(`Zoro: No results`);

    const matched = searchRes.results[0];
    const info = await zoro.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`Zoro: Episode not found`);

    let episodeId = targetEp.id;
    if (isDub && !episodeId.includes('$dub')) episodeId = episodeId.replace(/\$sub$/, '$dub');

    for (const server of [StreamingServers.VidCloud, StreamingServers.VidStreaming]) {
      try {
        const sources = await zoro.fetchEpisodeSources(episodeId, server);
        return this.sanitizeSources(sources, 'zoro', 'https://hianime.to/');
      } catch (err) { }
    }
    throw new Error('Zoro: Exhausted');
  }

  private async extractFromGogoanime(title: string, episode: number, isDub: boolean): Promise<IStreamResult> {
    const gogo = new ANIME.Gogoanime();
    const searchQuery = isDub ? `${title} (Dub)` : title;
    
    let searchRes = await gogo.search(searchQuery);
    if (!searchRes.results?.length && isDub) searchRes = await gogo.search(title); // fallback
    if (!searchRes.results?.length) throw new Error(`Gogoanime: No results`);

    const matched = searchRes.results[0];
    const info = await gogo.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`Gogoanime: Episode not found`);

    for (const server of [StreamingServers.VidStreaming, StreamingServers.GogoCDN, StreamingServers.StreamWish]) {
      try {
        const sources = await gogo.fetchEpisodeSources(targetEp.id, server);
        return this.sanitizeSources(sources, 'gogoanime', 'https://anitaku.pe/');
      } catch (err) { }
    }
    throw new Error('Gogoanime: Exhausted');
  }

  private async extractFromAnimePahe(title: string, episode: number, isDub: boolean): Promise<IStreamResult> {
    const pahe = new ANIME.AnimePahe();
    const searchRes = await pahe.search(title);
    if (!searchRes.results?.length) throw new Error(`AnimePahe: No results`);

    const matched = searchRes.results[0];
    const info = await pahe.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`AnimePahe: Episode not found`);

    const sources = await pahe.fetchEpisodeSources(targetEp.id);
    
    // AnimePahe sources natively contain "eng" or "jpn" in audio tags sometimes, or we just pass it along
    return this.sanitizeSources(sources, 'animepahe', 'https://animepahe.ru/');
  }

  // ─── Utilities ──────────────────────────────────────────────

  private sanitizeSources(rawSources: any, providerName: string, defaultReferer: string): IStreamResult {
    const sources: IStreamSource[] = (rawSources.sources || []).map((s: any) => ({
      url: s.url, quality: s.quality || (s.isM3U8 ? 'auto' : 'default'), isM3U8: Boolean(s.isM3U8),
    }));

    const subtitles: IStreamSubtitle[] = (rawSources.subtitles || []).map((s: any) => ({
      url: s.url, lang: s.lang?.toLowerCase().substring(0, 2) || 'en', label: s.lang || 'English', default: true
    }));

    return {
      success: sources.length > 0, provider: providerName, sources, subtitles,
      headers: { Referer: rawSources.headers?.Referer || defaultReferer },
    };
  }
}
