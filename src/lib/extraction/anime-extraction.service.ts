// ═══════════════════════════════════════════════════════════════
// Anime Extraction Service — Multi-provider cascading resolver
// ═══════════════════════════════════════════════════════════════
//
// Provider cascade: Zoro/HiAnime → Gogoanime → 9Anime
// Each provider cascades through its own server list.
// AniList ID → title resolution → provider search → episode match → source extraction.
//

import axios from 'axios';
import type {
  ExtractionContext,
  IStreamResult,
  IStreamSource,
  IStreamSubtitle,
} from '@/types/extraction-types';
import { ANIME, StreamingServers } from '@/lib/consumet';
import { ProviderRegistry, type ProviderEntry } from './provider-registry';
import { StealthHttpClient } from './stealth-client';

/**
 * Service responsible for extracting playable stream sources from anime providers.
 *
 * Flow:
 *   1. resolveTitle(anilistId) — get the English/Romaji title from AniList
 *   2. extractSources(ctx) — cascade through providers to find .m3u8 + subtitles
 */
export class AnimeExtractionService {
  private registry: ProviderRegistry;
  private stealthClient: StealthHttpClient;

  constructor() {
    this.registry = new ProviderRegistry();
    this.stealthClient = new StealthHttpClient();
  }

  // ─── Title Resolution ────────────────────────────────────────

  /**
   * Resolve anime title from AniList ID (or MAL ID with prefix).
   */
  async resolveTitle(mediaId: string): Promise<string> {
    const cleanId = mediaId.replace('anilist-', '').replace('mal-', '').replace('jikan-', '');
    const isMAL = mediaId.includes('mal') || mediaId.includes('jikan');
    const variables = isMAL
      ? { idMal: Number(cleanId) }
      : { id: Number(cleanId) };

    try {
      const query = `
        query ($id: Int, $idMal: Int) {
          Media(id: $id, idMal: $idMal, type: ANIME) {
            title { english romaji }
          }
        }
      `;

      const res = await this.stealthClient.post('https://graphql.anilist.co', {
        query,
        variables,
      }, { timeout: 4000 });

      const media = res.data?.data?.Media;
      const title = media?.title?.english || media?.title?.romaji;
      if (title) return title;
    } catch (err) {
      console.warn('[AnimeExtraction] AniList title resolution failed:', err);
    }

    // Fallback: try Jikan
    try {
      const jikanRes = await this.stealthClient.get(
        `https://api.jikan.moe/v4/anime/${cleanId}`,
        { timeout: 4000 }
      );
      const title = jikanRes.data?.data?.title_english || jikanRes.data?.data?.title;
      if (title) return title;
    } catch (err) {
      console.warn('[AnimeExtraction] Jikan title fallback failed:', err);
    }

    // Last resort: return the ID itself as a search term
    return cleanId.replace(/-/g, ' ');
  }

  // ─── Source Extraction ───────────────────────────────────────

  /**
   * Extract stream sources using multi-provider cascade.
   */
  async extractSources(ctx: ExtractionContext): Promise<IStreamResult> {
    const title = ctx.title || await this.resolveTitle(ctx.mediaId);
    const episode = ctx.episode || 1;

    // Build provider cascade
    const providers: ProviderEntry<IStreamResult>[] = [
      {
        name: 'zoro',
        priority: 0,
        mediaTypes: ['anime'],
        execute: () => this.extractFromZoro(title, episode, ctx.isDubbed),
      },
      {
        name: 'gogoanime',
        priority: 1,
        mediaTypes: ['anime'],
        execute: () => this.extractFromGogoanime(title, episode, ctx.isDubbed),
      },
    ];

    const result = await this.registry.executeWithCascade(providers);

    if (result.success && result.data) {
      return result.data;
    }

    // All providers failed — return empty result for iframe fallback
    return {
      success: false,
      provider: 'none',
      sources: [],
      subtitles: [],
      headers: {},
    };
  }

  // ─── Zoro/HiAnime Provider ──────────────────────────────────

  private async extractFromZoro(
    title: string,
    episode: number,
    isDubbed?: boolean
  ): Promise<IStreamResult> {
    const zoro = new ANIME.Zoro();
    const searchRes = await zoro.search(title);

    if (!searchRes.results?.length) {
      throw new Error(`Zoro: No results for "${title}"`);
    }

    // Find best match — prefer exact title match
    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched?.id) {
      throw new Error(`Zoro: No matching anime found for "${title}"`);
    }

    const info = await zoro.fetchAnimeInfo(matched.id);
    if (!info.episodes?.length) {
      throw new Error(`Zoro: No episodes found for "${matched.id}"`);
    }

    // Find target episode
    const targetEp = info.episodes.find((ep: any) => ep.number === episode)
      || info.episodes[episode - 1];

    if (!targetEp?.id) {
      throw new Error(`Zoro: Episode ${episode} not found`);
    }

    // Determine sub/dub suffix
    let episodeId = targetEp.id;
    if (isDubbed && !episodeId.includes('$dub')) {
      episodeId = episodeId.replace(/\$sub$/, '$dub');
    }

    // Server cascade: VidCloud → VidStreaming
    const serverCascade = [
      StreamingServers.VidCloud,
      StreamingServers.VidStreaming,
    ];

    for (const server of serverCascade) {
      try {
        const sources = await zoro.fetchEpisodeSources(episodeId, server);
        return this.sanitizeSources(sources, 'zoro', 'https://hianime.to/');
      } catch (err) {
        console.warn(`[AnimeExtraction] Zoro server ${server} failed:`, err);
      }
    }

    throw new Error('Zoro: All servers exhausted');
  }

  // ─── Gogoanime Provider ─────────────────────────────────────

  private async extractFromGogoanime(
    title: string,
    episode: number,
    isDubbed?: boolean
  ): Promise<IStreamResult> {
    const gogo = new ANIME.Gogoanime();

    // Search with dub suffix if needed
    const searchQuery = isDubbed ? `${title} (Dub)` : title;
    const searchRes = await gogo.search(searchQuery);

    if (!searchRes.results?.length) {
      // Retry without dub suffix
      const retryRes = await gogo.search(title);
      if (!retryRes.results?.length) {
        throw new Error(`Gogoanime: No results for "${title}"`);
      }
      searchRes.results = retryRes.results;
    }

    const matched = this.findBestMatch(searchRes.results, title);
    if (!matched?.id) {
      throw new Error(`Gogoanime: No matching anime found for "${title}"`);
    }

    const info = await gogo.fetchAnimeInfo(matched.id);
    if (!info.episodes?.length) {
      throw new Error(`Gogoanime: No episodes found for "${matched.id}"`);
    }

    const targetEp = info.episodes.find((ep: any) => ep.number === episode)
      || info.episodes[episode - 1];

    if (!targetEp?.id) {
      throw new Error(`Gogoanime: Episode ${episode} not found`);
    }

    // Server cascade: VidStreaming → GogoCDN → StreamWish
    const serverCascade = [
      StreamingServers.VidStreaming,
      StreamingServers.GogoCDN,
      StreamingServers.StreamWish,
    ];

    for (const server of serverCascade) {
      try {
        const sources = await gogo.fetchEpisodeSources(targetEp.id, server);
        return this.sanitizeSources(sources, 'gogoanime', 'https://anitaku.pe/');
      } catch (err) {
        console.warn(`[AnimeExtraction] Gogoanime server ${server} failed:`, err);
      }
    }

    throw new Error('Gogoanime: All servers exhausted');
  }

  // ─── Utilities ──────────────────────────────────────────────

  /**
   * Find the best matching result using simple string similarity.
   */
  private findBestMatch(results: any[], title: string): any {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const normalizedTitle = normalize(title);

    // First pass: exact match
    const exact = results.find(r => {
      const t = normalize(r.title || '');
      return t === normalizedTitle;
    });
    if (exact) return exact;

    // Second pass: includes match
    const includes = results.find(r => {
      const t = normalize(r.title || '');
      return t.includes(normalizedTitle) || normalizedTitle.includes(t);
    });
    if (includes) return includes;

    // Fallback: first result
    return results[0];
  }

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
      intro: rawSources.intro || undefined,
      outro: rawSources.outro || undefined,
      download: rawSources.download || undefined,
    };
  }
}
