// ═══════════════════════════════════════════════════════════════
// Manga Extraction Service — MangaDex API + Cheerio scraper fallbacks
// ═══════════════════════════════════════════════════════════════
//
// Provider cascade: MangaDex → AsuraScans → MangaPill
// Handles: chapter listing, page URL construction, Referer spoofing.
//

import { load } from 'cheerio';
import type {
  ExtractionContext,
  IMangaPage,
  IMangaPageResult,
  IMangaChapterEntry,
  IMangaChapterListResult,
} from '@/types/extraction-types';
import { MANGA } from '@/lib/consumet';
import { ProviderRegistry, type ProviderEntry } from './provider-registry';
import { StealthHttpClient } from './stealth-client';

// ─── MangaDex At-Home API Response Types ─────────────────────

interface MangaDexAtHomeResponse {
  baseUrl: string;
  chapter: {
    hash: string;
    data: string[];         // Full quality filenames
    dataSaver: string[];    // Data-saver quality filenames
  };
}

interface MangaDexFeedEntry {
  id: string;
  attributes: {
    title: string | null;
    chapter: string | null;
    volume: string | null;
    pages: number;
    translatedLanguage: string;
    publishAt: string;
  };
  relationships: Array<{
    id: string;
    type: string;
    attributes?: { name?: string };
  }>;
}

/**
 * Service responsible for extracting manga chapter pages from multiple providers.
 */
export class MangaExtractionService {
  private registry: ProviderRegistry;
  private stealthClient: StealthHttpClient;

  constructor() {
    this.registry = new ProviderRegistry();
    this.stealthClient = new StealthHttpClient();
  }

  // ═══════════════════════════════════════════════════════════
  // CHAPTER PAGE EXTRACTION
  // ═══════════════════════════════════════════════════════════

  /**
   * Fetch chapter pages using provider cascade.
   */
  async fetchChapterPages(
    mangaId: string,
    chapterId: string,
    provider?: string
  ): Promise<IMangaPageResult> {
    // If a specific provider is requested, use it directly
    if (provider === 'mangadex') {
      return this.fetchFromMangaDex(chapterId);
    }
    if (provider === 'asura' || provider === 'asurascans') {
      return this.fetchFromAsuraScans(chapterId);
    }
    if (provider === 'mangapill') {
      return this.fetchFromMangaPill(chapterId);
    }

    // Auto-cascade
    const providers: ProviderEntry<IMangaPageResult>[] = [
      {
        name: 'mangadex',
        priority: 0,
        mediaTypes: ['manga'],
        execute: () => this.fetchFromMangaDex(chapterId),
      },
      {
        name: 'mangadex-consumet',
        priority: 1,
        mediaTypes: ['manga'],
        execute: () => this.fetchFromMangaDexConsumet(chapterId),
      },
    ];

    const result = await this.registry.executeWithCascade(providers);

    if (result.success && result.data) {
      return result.data;
    }

    return {
      success: false,
      provider: 'none',
      pages: [],
      headers: {},
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CHAPTER LIST
  // ═══════════════════════════════════════════════════════════

  /**
   * Fetch the full chapter list for a manga.
   */
  async fetchChapterList(
    mangaId: string,
    provider?: string
  ): Promise<IMangaChapterListResult> {
    if (provider === 'mangadex' || !provider) {
      return this.fetchChapterListFromMangaDex(mangaId);
    }

    return {
      success: false,
      provider: 'none',
      chapters: [],
      totalChapters: 0,
    };
  }

  // ─── MangaDex ID Resolution ────────────────────────────────

  /**
   * Resolve a MangaDex UUID from an AniList ID + title.
   */
  async resolveMangaDexId(anilistId: number, title: string): Promise<string | null> {
    // Strategy 1: Search MangaDex API by title
    try {
      const searchRes = await this.stealthClient.get(
        `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=5&order[relevance]=desc`,
        { timeout: 5000 }
      );

      const results = searchRes.data?.data;
      if (results?.length > 0) {
        // Return first match (MangaDex relevance ordering is good)
        return results[0].id;
      }
    } catch (err) {
      console.warn('[MangaExtraction] MangaDex search failed:', err);
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // PROVIDER IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════

  // ─── MangaDex (Direct API) ─────────────────────────────────

  /**
   * Fetch chapter pages directly from the MangaDex at-home API.
   * This is the most reliable method as it uses the official API.
   *
   * API: GET https://api.mangadex.org/at-home/server/{chapterId}
   * Returns: baseUrl + hash + filename arrays
   * Constructed URL: {baseUrl}/data/{hash}/{filename}?forcePort443=true
   */
  private async fetchFromMangaDex(chapterId: string): Promise<IMangaPageResult> {
    const res = await this.stealthClient.get<MangaDexAtHomeResponse>(
      `https://api.mangadex.org/at-home/server/${chapterId}`,
      { timeout: 6000 }
    );

    const { baseUrl, chapter } = res.data;
    if (!chapter?.data?.length) {
      throw new Error('MangaDex: No page data returned');
    }

    const pages: IMangaPage[] = chapter.data.map((filename, index) => ({
      url: `${baseUrl}/data/${chapter.hash}/${filename}?forcePort443=true`,
      page: index + 1,
    }));

    return {
      success: true,
      provider: 'mangadex',
      pages,
      headers: {
        Referer: 'https://mangadex.org/',
      },
    };
  }

  /**
   * Fetch chapter pages using the local Consumet MangaDex provider.
   */
  private async fetchFromMangaDexConsumet(chapterId: string): Promise<IMangaPageResult> {
    const md = new MANGA.MangaDex();
    const rawPages = await md.fetchChapterPages(chapterId);

    if (!rawPages?.length) {
      throw new Error('MangaDex (Consumet): No pages returned');
    }

    const pages: IMangaPage[] = rawPages.map((p: any) => ({
      url: p.img.includes('?') ? p.img : `${p.img}?forcePort443=true`,
      page: p.page,
    }));

    return {
      success: true,
      provider: 'mangadex-consumet',
      pages,
      headers: {
        Referer: 'https://mangadex.org/',
      },
    };
  }

  // ─── AsuraScans (Cheerio Scraper) ──────────────────────────

  /**
   * Scrape chapter pages from AsuraScans.
   * The chapterId here is the full chapter URL path.
   *
   * Spoofs Referer to avoid 403 on image requests.
   */
  private async fetchFromAsuraScans(chapterUrl: string): Promise<IMangaPageResult> {
    const baseUrl = 'https://asuracomic.net';
    const fullUrl = chapterUrl.startsWith('http') ? chapterUrl : `${baseUrl}/${chapterUrl}`;

    const res = await this.stealthClient.get(fullUrl, {
      referer: baseUrl,
      timeout: 8000,
    });

    const $ = load(res.data);
    const pages: IMangaPage[] = [];

    // AsuraScans uses img tags with class 'ts-main-image' or similar
    $('img.ts-main-image, .rdminimal img, #readerarea img').each((i, el) => {
      const src = $(el).attr('src')?.trim();
      if (src && !src.includes('logo') && !src.includes('icon')) {
        pages.push({
          url: src.startsWith('http') ? src : `${baseUrl}${src}`,
          page: pages.length + 1,
        });
      }
    });

    if (!pages.length) {
      throw new Error('AsuraScans: No pages found');
    }

    return {
      success: true,
      provider: 'asurascans',
      pages,
      headers: {
        Referer: `${baseUrl}/`,
        Origin: baseUrl,
      },
    };
  }

  // ─── MangaPill (Cheerio Scraper) ───────────────────────────

  /**
   * Scrape chapter pages from MangaPill.
   * The chapterId here is the full chapter URL path.
   */
  private async fetchFromMangaPill(chapterUrl: string): Promise<IMangaPageResult> {
    const baseUrl = 'https://mangapill.com';
    const fullUrl = chapterUrl.startsWith('http') ? chapterUrl : `${baseUrl}/${chapterUrl}`;

    const res = await this.stealthClient.get(fullUrl, {
      referer: baseUrl,
      timeout: 8000,
    });

    const $ = load(res.data);
    const pages: IMangaPage[] = [];

    // MangaPill chapter pages use img.chapter-page or similar
    $('img.chapter-page, chapter-page img, .container--reader-chapter img').each((i, el) => {
      const src = $(el).attr('data-src') || $(el).attr('src');
      if (src?.trim()) {
        pages.push({
          url: src.startsWith('http') ? src : `${baseUrl}${src}`,
          page: pages.length + 1,
        });
      }
    });

    if (!pages.length) {
      throw new Error('MangaPill: No pages found');
    }

    return {
      success: true,
      provider: 'mangapill',
      pages,
      headers: {
        Referer: `${baseUrl}/`,
        Origin: baseUrl,
      },
    };
  }

  // ─── MangaDex Chapter List ─────────────────────────────────

  /**
   * Fetch the full chapter list from MangaDex API with pagination.
   */
  private async fetchChapterListFromMangaDex(
    mangaId: string
  ): Promise<IMangaChapterListResult> {
    const chapters: IMangaChapterEntry[] = [];
    let offset = 0;
    const limit = 96;
    let total = Infinity;

    while (offset < total) {
      const res = await this.stealthClient.get(
        `https://api.mangadex.org/manga/${mangaId}/feed` +
        `?offset=${offset}&limit=${limit}` +
        `&order[volume]=desc&order[chapter]=desc` +
        `&translatedLanguage[]=en` +
        `&includes[]=scanlation_group`,
        { timeout: 8000 }
      );

      total = res.data.total || 0;
      const entries: MangaDexFeedEntry[] = res.data.data || [];

      for (const entry of entries) {
        const scanlationGroup = entry.relationships?.find(r => r.type === 'scanlation_group');

        chapters.push({
          id: entry.id,
          title: entry.attributes.title || entry.attributes.chapter || `Chapter ${entry.attributes.chapter}`,
          chapterNumber: entry.attributes.chapter || '0',
          volumeNumber: entry.attributes.volume || undefined,
          pages: entry.attributes.pages,
          scanlationGroup: scanlationGroup?.attributes?.name || undefined,
          publishedAt: entry.attributes.publishAt,
        });
      }

      offset += limit;

      // Safety valve — don't fetch more than 2000 chapters
      if (offset > 2000) break;
    }

    return {
      success: chapters.length > 0,
      provider: 'mangadex',
      chapters,
      totalChapters: chapters.length,
    };
  }
}
