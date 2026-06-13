'use server';

import { aggregateChapters, aggregatePages } from '@/lib/api/manga-aggregator';
import type { MangaChapter, MangaPageResult } from '@/lib/api/manga-aggregator';

/**
 * Fetch all chapters for a manga by resolving the AniList title
 * and searching across all manga providers.
 */
export async function fetchMangaChaptersAction(anilistId: string): Promise<MangaChapter[]> {
  try {
    const { getMangaDetail } = await import('@/lib/api/anilist');
    const media = await getMangaDetail(anilistId);
    const title = media.title?.english || media.title?.romaji || media.title?.native || '';
    
    if (!title) return [];

    const result = await aggregateChapters(title);
    if (!result) return [];

    return result.chapters;
  } catch (err) {
    console.error('[fetchMangaChaptersAction] Failed:', err);
    return [];
  }
}

export async function fetchMangaChapterPagesAction(chapterId: string, providerName?: string): Promise<string[]> {
  try {
    const result: MangaPageResult = await aggregatePages(chapterId, providerName);
    
    // Determine the correct Referer header to bypass CDN hotlinking restrictions
    let referer = 'https://mangadex.org/';
    const provider = result.providerName.toLowerCase();
    if (provider === 'mangapill') {
      referer = 'https://mangapill.com/';
    } else if (provider === 'comick') {
      referer = 'https://comick.app/';
    } else if (provider === 'mangafire') {
      referer = 'https://mangafire.to/';
    }

    // Proxy the URLs using the local streaming proxy route
    return result.pages.map(url => {
      return `/api/stream/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer)}`;
    });
  } catch (err) {
    console.error('[fetchMangaChapterPagesAction] Failed:', err);
    return [];
  }
}
