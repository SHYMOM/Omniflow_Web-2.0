'use server';

/**
 * ═══════════════════════════════════════════════════════════════
 * Manga Reading Aggregator — Multi-provider chapter & page resolution
 * ═══════════════════════════════════════════════════════════════
 * 
 * Searches across multiple manga providers (MangaDex, ComicK, MangaPill, etc.)
 * to find and serve chapter content. Mirrors the streaming aggregator pattern
 * used for video content.
 */

import { MANGA } from '@/lib/consumet';

// ─── Types ───────────────────────────────────────────────────

export interface MangaChapter {
  id: string;
  providerId: string;
  providerName: string;
  number: number;
  title: string;
  volumeNumber?: string;
  pages: number;
  releasedDate?: string;
}

export interface MangaProviderResult {
  providerName: string;
  mangaId: string;
  chapters: MangaChapter[];
}

export interface MangaPageResult {
  pages: string[];
  providerName: string;
  chapterId: string;
}

// ─── Provider Abstraction ────────────────────────────────────

interface MangaProviderAdapter {
  name: string;
  search: (title: string) => Promise<{ id: string; title: string } | null>;
  fetchChapters: (mangaId: string) => Promise<MangaChapter[]>;
  fetchPages: (chapterId: string) => Promise<string[]>;
}

function createMangaDexAdapter(): MangaProviderAdapter {
  return {
    name: 'MangaDex',
    search: async (title: string) => {
      const mangadex = new MANGA.MangaDex();
      const res = await mangadex.search(title);
      if (res.results && res.results.length > 0) {
        return { id: res.results[0].id, title: res.results[0].title as string || title };
      }
      return null;
    },
    fetchChapters: async (mangaId: string) => {
      const mangadex = new MANGA.MangaDex();
      const info = await mangadex.fetchMangaInfo(mangaId);
      if (!info.chapters || info.chapters.length === 0) return [];
      
      // Deduplicate by chapter number (keep first occurrence per number)
      const chapterMap = new Map<number, MangaChapter>();
      for (const ch of info.chapters) {
        const c = ch as any;
        const num = parseFloat(String(c.chapterNumber)) || 0;
        if (num > 0 && !chapterMap.has(num)) {
          chapterMap.set(num, {
            id: c.id,
            providerId: 'mangadex',
            providerName: 'MangaDex',
            number: num,
            title: c.title && c.title !== c.chapterNumber ? c.title : `Chapter ${c.chapterNumber || num}`,
            volumeNumber: c.volumeNumber,
            pages: c.pages || 0,
            releasedDate: c.releaseDate || undefined,
          });
        }
      }
      return Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);
    },
    fetchPages: async (chapterId: string) => {
      const mangadex = new MANGA.MangaDex();
      const pages = await mangadex.fetchChapterPages(chapterId);
      return pages.map((p: any) => p.img || p.url || '').filter(Boolean);
    },
  };
}

function createComicKAdapter(): MangaProviderAdapter {
  return {
    name: 'ComicK',
    search: async (title: string) => {
      const comick = new MANGA.ComicK();
      const res = await comick.search(title);
      if (res.results && res.results.length > 0) {
        return { id: res.results[0].id, title: res.results[0].title as string || title };
      }
      return null;
    },
    fetchChapters: async (mangaId: string) => {
      const comick = new MANGA.ComicK();
      const info = await comick.fetchMangaInfo(mangaId);
      if (!info.chapters || info.chapters.length === 0) return [];
      
      const chapterMap = new Map<number, MangaChapter>();
      for (const ch of info.chapters) {
        const c = ch as any;
        const num = parseFloat(String(c.chapterNumber)) || 0;
        if (num > 0 && !chapterMap.has(num)) {
          chapterMap.set(num, {
            id: c.id,
            providerId: 'comick',
            providerName: 'ComicK',
            number: num,
            title: c.title && c.title !== c.chapterNumber ? c.title : `Chapter ${c.chapterNumber || num}`,
            volumeNumber: c.volumeNumber,
            pages: 0,
            releasedDate: c.releaseDate || undefined,
          });
        }
      }
      return Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);
    },
    fetchPages: async (chapterId: string) => {
      const comick = new MANGA.ComicK();
      const pages = await comick.fetchChapterPages(chapterId);
      return pages.map((p: any) => p.img || p.url || '').filter(Boolean);
    },
  };
}

function createMangaPillAdapter(): MangaProviderAdapter {
  return {
    name: 'MangaPill',
    search: async (title: string) => {
      const mp = new MANGA.MangaPill();
      const res = await mp.search(title);
      if (res.results && res.results.length > 0) {
        return { id: res.results[0].id, title: res.results[0].title as string || title };
      }
      return null;
    },
    fetchChapters: async (mangaId: string) => {
      const mp = new MANGA.MangaPill();
      const info = await mp.fetchMangaInfo(mangaId);
      if (!info.chapters || info.chapters.length === 0) return [];
      
      return info.chapters.map((ch: any) => {
        const num = parseFloat(ch.chapter || ch.chapterNumber) || 0;
        return {
          id: ch.id,
          providerId: 'mangapill',
          providerName: 'MangaPill',
          number: num,
          title: ch.title || `Chapter ${num}`,
          pages: 0,
        };
      }).filter((ch: MangaChapter) => ch.number > 0).sort((a: MangaChapter, b: MangaChapter) => a.number - b.number);
    },
    fetchPages: async (chapterId: string) => {
      const mp = new MANGA.MangaPill();
      const pages = await mp.fetchChapterPages(chapterId);
      return pages.map((p: any) => p.img || p.url || '').filter(Boolean);
    },
  };
}

function createMangaFireAdapter(): MangaProviderAdapter {
  return {
    name: 'MangaFire',
    search: async (title: string) => {
      const mf = new MANGA.MangaFire();
      const res = await mf.search(title);
      if (res.results && res.results.length > 0) {
        return { id: res.results[0].id, title: res.results[0].title as string || title };
      }
      return null;
    },
    fetchChapters: async (mangaId: string) => {
      const mf = new MANGA.MangaFire();
      const info = await mf.fetchMangaInfo(mangaId);
      if (!info.chapters || info.chapters.length === 0) return [];
      
      return info.chapters.map((ch: any) => {
        const num = parseFloat(String(ch.chapterNumber)) || 0;
        return {
          id: ch.id,
          providerId: 'mangafire',
          providerName: 'MangaFire',
          number: num,
          title: ch.title || `Chapter ${num}`,
          pages: 0,
        };
      }).filter((ch: MangaChapter) => ch.number > 0).sort((a: MangaChapter, b: MangaChapter) => a.number - b.number);
    },
    fetchPages: async (chapterId: string) => {
      const mf = new MANGA.MangaFire();
      const pages = await mf.fetchChapterPages(chapterId);
      return pages.map((p: any) => p.img || p.url || '').filter(Boolean);
    },
  };
}

// ─── Aggregator Core ─────────────────────────────────────────

const PROVIDERS: MangaProviderAdapter[] = [
  createMangaDexAdapter(),
  createComicKAdapter(),
  createMangaPillAdapter(),
  createMangaFireAdapter(),
];

/**
 * Search all providers for a manga by title and return chapters from the provider
 * that has the most complete chapter list (highest chapter count).
 */
export async function aggregateChapters(title: string): Promise<MangaProviderResult | null> {
  const promises = PROVIDERS.map(async (provider) => {
    try {
      const match = await provider.search(title);
      if (!match) return null;

      const chapters = await provider.fetchChapters(match.id);
      if (chapters.length > 0) {
        return {
          providerName: provider.name,
          mangaId: match.id,
          chapters,
        };
      }
    } catch (err: any) {
      console.warn(`[MangaAggregator] ${provider.name} failed during search/fetch:`, err.message || err);
    }
    return null;
  });

  const results = await Promise.all(promises);
  const validResults = results.filter((r): r is MangaProviderResult => r !== null);

  if (validResults.length === 0) {
    console.warn(`[MangaAggregator] All providers failed for title: "${title}"`);
    return null;
  }

  // Sort by chapter count descending to pick the provider with the most content
  validResults.sort((a, b) => b.chapters.length - a.chapters.length);

  const best = validResults[0];
  console.log(`[MangaAggregator] Selected ${best.providerName} for "${title}" with ${best.chapters.length} chapters. (Tested providers: ${validResults.map(r => `${r.providerName} (${r.chapters.length} ch)`).join(', ')})`);
  
  return best;
}

/**
 * Fetch the actual image pages for a given chapter.
 * Accepts either a provider-prefixed ID (e.g. "mangadex:abc-123")
 * or a raw chapter ID (defaults to MangaDex).
 */
export async function aggregatePages(chapterId: string, providerName?: string): Promise<MangaPageResult> {
  // Parse provider prefix if present
  let actualId = chapterId;
  let targetProvider = providerName || 'MangaDex';
  
  if (chapterId.includes(':')) {
    const [prefix, id] = chapterId.split(':', 2);
    actualId = id;
    targetProvider = prefix;
  }

  // Try the target provider first
  const targetAdapter = PROVIDERS.find(p => p.name.toLowerCase() === targetProvider.toLowerCase());
  if (targetAdapter) {
    try {
      const pages = await targetAdapter.fetchPages(actualId);
      if (pages.length > 0) {
        return { pages, providerName: targetAdapter.name, chapterId: actualId };
      }
    } catch (err: any) {
      console.warn(`[MangaAggregator] ${targetAdapter.name} pages failed:`, err.message || err);
    }
  }

  // Fallback: If target failed and it is not MangaPill, let's search if MangaPill has a matching chapter
  // but since chapter IDs differ across providers, we can't easily map a raw ID without searching.
  return { pages: [], providerName: targetProvider, chapterId: actualId };
}
