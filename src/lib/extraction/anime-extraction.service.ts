// ═══════════════════════════════════════════════════════════════
// Anime Extraction Service — Multi-provider cascading resolver
// ═══════════════════════════════════════════════════════════════

import type {
  ExtractionContext,
  IStreamResult,
  IStreamSource,
  IStreamSubtitle,
} from '@/types/extraction-types';
import { ANIME, DONGHUA, StreamingServers } from '@/lib/consumet';
import { ProviderRegistry, type ProviderEntry } from './provider-registry';
import { StealthHttpClient } from './stealth-client';
import { getCachedStream, setCachedStream } from '@/lib/cache/redis';
import { PLAYWRIGHT_ENABLED } from './extraction-config';
import { MovieboxExtractor } from './moviebox-extractor';
import { StremioExtractor } from './stremio-extractor';
import { HindiDubbedExtractor } from './hindidubbed-extractor';
import { DesiDubAnimeExtractor } from './desidubanime-extractor';
import { titleSimilarity } from './string-matching';

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

  // ─── ID Mapping ──────────────────────────────────────────────

  async mapIds(mediaId: string): Promise<{ tmdbId: string | null; imdbId: string | null }> {
    const cleanId = mediaId.replace('anilist-', '').replace('mal-', '').replace('jikan-', '');
    const source = mediaId.includes('mal') || mediaId.includes('jikan') ? 'myanimelist' : 'anilist';
    
    try {
      // Use Anime Resource Mapper API with a very strict timeout (1500ms) to fail fast
      const res = await this.stealthClient.get(`https://arm.haglund.dev/api/v2/ids?source=${source}&id=${cleanId}`, { timeout: 1500 });
      if (res.data) {
        return {
          tmdbId: res.data.themoviedb ? String(res.data.themoviedb) : null,
          imdbId: res.data.imdb || null
        };
      }
    } catch (e) {
      // Silently fail fast if the external mapper is down, we have native fallbacks
    }
    return { tmdbId: null, imdbId: null };
  }

  // ─── Source Extraction & Caching ─────────────────────────────

  async extractSources(ctx: ExtractionContext): Promise<IStreamResult> {
    const title = ctx.title || await this.resolveTitle(ctx.mediaId);
    const episode = ctx.episode || 1;
    // Explicitly track if Hindi was requested for Gogoanime fallback routing
    const isHindi = ctx.language === 'hin';
    const isDub = ctx.isDubbed || ctx.language === 'eng' || ctx.language === 'dub' || isHindi;
    
    const cacheKey = `stream:anime:${ctx.mediaId}:ep${episode}:${isDub ? 'dub' : 'sub'}`;
    const cached = await getCachedStream(cacheKey);
    if (cached) return cached;

    // Resolve TMDB/IMDB IDs for premium OMSS scrapers
    const { tmdbId } = await this.mapIds(ctx.mediaId);

    // Build strictly native/reliable providers
    const providers: ProviderEntry<IStreamResult>[] = [
      {
        name: 'cinepro-core',
        priority: 0,
        mediaTypes: ['anime'],
        execute: async () => {
          if (!tmdbId) throw new Error('CineproCore: Requires TMDB ID mapping');
          const { CineproAggregator } = await import('./cinepro-aggregator');
          const cinepro = new CineproAggregator();
          
          const { sources, subtitles } = await cinepro.scrapeSeries(tmdbId, 1, episode);
          
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
        name: 'moviebox',
        priority: 1,
        mediaTypes: ['anime'],
        execute: () => {
           if (!tmdbId) throw new Error('Moviebox: Requires TMDB ID mapping');
           return new MovieboxExtractor().extractDirectStream(title, 'tv', episode, 1);
        }
      },
      {
        name: 'hindidubbed',
        priority: 1.5,
        mediaTypes: ['anime'],
        execute: () => {
           if (!isHindi) throw new Error('HindiDubbed: Only runs for Hindi queries');
           return new HindiDubbedExtractor().extractDirectStream(title, episode);
        }
      },
      {
        name: 'desidubanime',
        priority: 1.6,
        mediaTypes: ['anime'],
        execute: () => {
           if (!isHindi) throw new Error('DesiDubAnime: Only runs for Hindi queries');
           return new DesiDubAnimeExtractor().extractDirectStream(title, episode);
        }
      },
      {
        name: 'zoro',
        priority: 2,
        mediaTypes: ['anime'],
        execute: () => this.extractFromZoro(title, episode, ctx.language || 'sub'),
      },
      {
        name: 'animoye',
        priority: 2.1,
        mediaTypes: ['anime'],
        execute: () => this.extractFromAnimoye(title, episode, ctx.language || 'sub'),
      },
      {
        name: 'aniwatchx',
        priority: 2.2,
        mediaTypes: ['anime'],
        execute: () => this.extractFromAniwatchX(title, episode, ctx.language || 'sub'),
      },
      {
        name: 'cksub',
        priority: 2.3,
        mediaTypes: ['anime'],
        execute: () => this.extractFromCKSub(title, episode, ctx.language || 'sub'),
      },
      {
        name: 'donghuastream',
        priority: 2.4,
        mediaTypes: ['anime'],
        execute: () => this.extractFromDonghuaStream(title, episode, ctx.language || 'sub'),
      },
      {
        name: 'lmanime',
        priority: 2.5,
        mediaTypes: ['anime'],
        execute: () => this.extractFromLMAnime(title, episode, ctx.language || 'sub'),
      },
      {
        name: 'gogoanime',
        priority: 3,
        mediaTypes: ['anime'],
        execute: () => this.extractFromGogoanime(title, episode, ctx.language || 'sub'),
      },
      {
        name: 'animepahe',
        priority: 4,
        mediaTypes: ['anime'],
        execute: () => this.extractFromAnimePahe(title, episode, ctx.language || 'sub'),
      }
    ];

    // Filter active providers based on query parameters (e.g. only run Hindi providers for Hindi language queries)
    const activeProviders = providers.filter(p => {
      if (p.name === 'hindidubbed' || p.name === 'desidubanime') {
        return isHindi;
      }
      return true;
    });

    const result = await this.registry.executeConcurrently(activeProviders);

    if (result.success && result.data) {
      // Set default available languages immediately to avoid blocking the client
      result.data.availableLanguages = ['sub', 'eng', 'hin'];

      // Perform language discovery in the background to update the cache asynchronously
      this.determineAvailableLanguages(title).then(async (discoveredLangs) => {
        if (result.data) {
          result.data.availableLanguages = discoveredLangs;
          await setCachedStream(cacheKey, result.data, 10800);
        }
      }).catch(() => {});

      await setCachedStream(cacheKey, result.data, 10800);
      return result.data;
    }

    return { success: false, provider: 'none', sources: [], subtitles: [], headers: {} };
  }

  // ─── Parallel Language Discovery ─────────────────────────────

  private async determineAvailableLanguages(title: string): Promise<string[]> {
    const langs = ['sub'];
    try {
      const gogo = new ANIME.Gogoanime();
      
      // Quick parallel probes for dubs using Gogoanime's fast search
      const probes = await Promise.allSettled([
        gogo.search(`${title} (Dub)`).then(res => res.results && res.results.length > 0),
        gogo.search(`${title} Hindi Dubbed`).then(res => res.results && res.results.length > 0),
        gogo.search(`${title} Hindi`).then(res => res.results && res.results.length > 0)
      ]);
      
      if (probes[0].status === 'fulfilled' && probes[0].value) langs.push('eng', 'dub');
      if ((probes[1].status === 'fulfilled' && probes[1].value) || (probes[2].status === 'fulfilled' && probes[2].value)) langs.push('hin');
    } catch (e) {
      console.warn('[AnimeExtraction] Language discovery probe failed:', e);
      // Fallback to basic assumption if probe fails
      return ['sub', 'eng', 'hin'];
    }
    
    return langs;
  }

  // ─── Utilities ──────────────────────────────────────────────
  
  private findBestMatch(results: any[], targetTitle: string): any {
    if (!results || results.length === 0) return null;
    const target = targetTitle.toLowerCase().trim();
    
    // 1. Exact match
    let best = results.find(r => {
      const t = (r.title || r.title?.english || r.title?.romaji || '').toLowerCase().trim();
      return t === target || t === `${target} (dub)` || t === `${target} (tv)`;
    });
    if (best) return best;

    // 2. Starts with match (prevents "Boruto: Naruto Next Gen" winning over "Naruto")
    best = results.find(r => {
      const t = (r.title || r.title?.english || r.title?.romaji || '').toLowerCase().trim();
      return t.startsWith(target);
    });
    if (best) return best;

    // 3. Includes match
    best = results.find(r => {
      const t = (r.title || r.title?.english || r.title?.romaji || '').toLowerCase().trim();
      return t.includes(target);
    });
    if (best) return best;

    // 4. Absolute fallback
    return results[0];
  }

  // ─── Provider Implementations ────────────────────────────────

  private async extractFromZoro(title: string, episode: number, language: string): Promise<IStreamResult> {
    const zoro = new ANIME.Zoro();
    const searchRes = await zoro.search(title);
    if (!searchRes.results?.length) throw new Error(`Zoro: No results`);

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched) throw new Error(`Zoro: No matched results`);

    const info = await zoro.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`Zoro: Episode not found`);

    const tryExtract = async (langExt: string) => {
      let episodeId = targetEp.id;
      const cleanLang = langExt.replace('$', '');
      const parts = episodeId.split('$');
      if (parts.length > 1) {
        parts[parts.length - 1] = cleanLang;
        episodeId = parts.join('$');
      } else {
        episodeId = `${episodeId}$${cleanLang}`;
      }
      
      for (const server of [StreamingServers.VidCloud, StreamingServers.VidStreaming]) {
        try {
          const sources = await zoro.fetchEpisodeSources(episodeId, server);
          if (sources.sources?.length > 0) {
            const inferredLang = langExt === '$dub' ? 'eng-dub' : 'sub';
            return this.sanitizeSources(sources, 'zoro', 'https://hianime.to/', inferredLang);
          }
        } catch (err) { }
      }
      throw new Error('Zoro: Exhausted');
    };

    // Fast Fallback Loop: Try exact preference first, then fallback to sub
    const preferences = [];
    if (language === 'hin') preferences.push('$dub', '$sub');
    else if (language === 'eng' || language === 'dub') preferences.push('$dub', '$sub');
    else preferences.push('$sub', '$dub'); // if sub preferred, try sub then dub

    for (const pref of preferences) {
      try {
        const result = await tryExtract(pref);
        if (result) return result;
      } catch (e) {}
    }
    
    throw new Error('Zoro: All language fallbacks exhausted');
  }

  private async extractFromGogoanime(title: string, episode: number, language: string): Promise<IStreamResult> {
    const gogo = new ANIME.Gogoanime();
    
    // Fast Fallback Loop: Hindi -> English -> Sub
    const queries = [];
    if (language === 'hin') {
      queries.push(`${title} Hindi Dubbed`, `${title} Hindi`, `${title} (Dub)`, `${title} Dub`, title);
    } else if (language === 'eng' || language === 'dub') {
      queries.push(`${title} (Dub)`, `${title} Dub`, `${title} dub`, title);
    } else {
      queries.push(title, `${title} (Dub)`, `${title} Dub`); // Sub preferred, but fallback to dub if sub not found
    }

    let matched;
    for (const q of queries) {
       try {
          const searchRes = await gogo.search(q);
          if (searchRes.results?.length) {
             matched = this.findBestMatch(searchRes.results, title);
             if (matched) break;
          }
       } catch (e) {}
    }
    if (!matched) throw new Error(`Gogoanime: No results`);

    const info = await gogo.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`Gogoanime: Episode not found`);

    for (const server of [StreamingServers.VidStreaming, StreamingServers.GogoCDN, StreamingServers.StreamWish]) {
      try {
        const sources = await gogo.fetchEpisodeSources(targetEp.id, server);
        let inferredLang = 'sub';
        if (matched.id.includes('-dub')) inferredLang = 'eng-dub';
        else if (matched.id.includes('-hindi')) inferredLang = 'hin-dub';
        return this.sanitizeSources(sources, 'gogoanime', 'https://anitaku.pe/', inferredLang);
      } catch (err) { }
    }
    throw new Error('Gogoanime: Exhausted');
  }

  private async extractFromAnimePahe(title: string, episode: number, language: string): Promise<IStreamResult> {
    const pahe = new ANIME.AnimePahe();
    const searchRes = await pahe.search(title);
    if (!searchRes.results?.length) throw new Error(`AnimePahe: No results`);

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched) throw new Error(`AnimePahe: No matched results`);

    const info = await pahe.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`AnimePahe: Episode not found`);

    const sources = await pahe.fetchEpisodeSources(targetEp.id);
    
    // AnimePahe sources natively contain "eng" or "jpn" in audio tags sometimes, or we just pass it along
    return this.sanitizeSources(sources, 'animepahe', 'https://animepahe.ru/', 'sub');
  }

  private async extractFromAnimoye(title: string, episode: number, language: string): Promise<IStreamResult> {
    const animoye = new (ANIME as any).Animoye();
    const searchRes = await animoye.search(title);
    if (!searchRes.results?.length) throw new Error(`Animoye: No results`);

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched) throw new Error(`Animoye: No matched results`);

    const info = await animoye.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`Animoye: Episode not found`);

    const sources = await animoye.fetchEpisodeSources(targetEp.id);
    return this.sanitizeSources(sources, 'animoye', 'https://animoye.com/', 'sub');
  }

  private async extractFromAniwatchX(title: string, episode: number, language: string): Promise<IStreamResult> {
    const aniwatchx = new (ANIME as any).AniwatchX();
    const searchRes = await aniwatchx.search(title);
    if (!searchRes.results?.length) throw new Error(`AniwatchX: No results`);

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched) throw new Error(`AniwatchX: No matched results`);

    const info = await aniwatchx.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`AniwatchX: Episode not found`);

    const sources = await aniwatchx.fetchEpisodeSources(targetEp.id);
    return this.sanitizeSources(sources, 'aniwatchx', 'https://aniwatchx.to/', 'sub');
  }

  private async extractFromCKSub(title: string, episode: number, language: string): Promise<IStreamResult> {
    const cksub = new (ANIME as any).CKSub();
    const searchRes = await cksub.search(title);
    if (!searchRes.results?.length) throw new Error(`CKSub: No results`);

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched) throw new Error(`CKSub: No matched results`);

    const info = await cksub.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`CKSub: Episode not found`);

    const sources = await cksub.fetchEpisodeSources(targetEp.id);
    return this.sanitizeSources(sources, 'cksub', 'https://cksub.org/', 'sub');
  }

  private async extractFromDonghuaStream(title: string, episode: number, language: string): Promise<IStreamResult> {
    const ds = new (DONGHUA as any).DonghuaStream();
    const searchRes = await ds.search(title);
    if (!searchRes.results?.length) throw new Error(`DonghuaStream: No results`);

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched) throw new Error(`DonghuaStream: No matched results`);

    const info = await ds.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`DonghuaStream: Episode not found`);

    const sources = await ds.fetchEpisodeSources(targetEp.id);
    return this.sanitizeSources(sources, 'donghuastream', 'https://donghuastream.org/', 'sub');
  }

  private async extractFromLMAnime(title: string, episode: number, language: string): Promise<IStreamResult> {
    const lm = new (DONGHUA as any).LMAnime();
    const searchRes = await lm.search(title);
    if (!searchRes.results?.length) throw new Error(`LMAnime: No results`);

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched) throw new Error(`LMAnime: No matched results`);

    const info = await lm.fetchAnimeInfo(matched.id);
    const targetEp = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];
    if (!targetEp?.id) throw new Error(`LMAnime: Episode not found`);

    const sources = await lm.fetchEpisodeSources(targetEp.id);
    return this.sanitizeSources(sources, 'lmanime', 'https://lmanime.com/', 'sub');
  }

  // ─── Utilities ──────────────────────────────────────────────

  private sanitizeSources(rawSources: any, providerName: string, defaultReferer: string, inferredLang?: string): IStreamResult {
    const sources: IStreamSource[] = (rawSources.sources || []).map((s: any) => ({
      url: s.url, quality: s.quality || (s.isM3U8 ? 'auto' : 'default'), isM3U8: Boolean(s.isM3U8),
    }));

    const subtitles: IStreamSubtitle[] = (rawSources.subtitles || []).map((s: any) => ({
      url: s.url, lang: s.lang?.toLowerCase().substring(0, 2) || 'en', label: s.lang || 'English', default: true
    }));

    const result: IStreamResult = {
      success: sources.length > 0, provider: providerName, sources, subtitles,
      headers: { Referer: rawSources.headers?.Referer || defaultReferer },
    };
    
    // Pass the inferred language down to the sources array so the Universal Aggregator maps it correctly
    if (inferredLang) {
      result.availableLanguages = [inferredLang];
      result.sources = result.sources.map(s => ({ ...s, language: inferredLang } as any));
    }

    return result;
  }
}
