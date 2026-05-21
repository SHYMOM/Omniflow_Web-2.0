import { NextRequest, NextResponse } from 'next/server';
import { MangaExtractionService } from '@/lib/extraction';

const mangaService = new MangaExtractionService();

/**
 * GET /api/manga
 *
 * Fetch chapter pages for a manga.
 *
 * Query params:
 *   - mangaId:   MangaDex manga UUID or provider-specific ID
 *   - chapterId: Chapter ID (MangaDex UUID or chapter URL path for scrapers)
 *   - provider:  (optional) 'mangadex' | 'asura' | 'mangapill' — defaults to auto-cascade
 *
 * Returns: IMangaPageResult JSON
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mangaId = searchParams.get('mangaId') || '';
    const chapterId = searchParams.get('chapterId') || '';
    const provider = searchParams.get('provider') || undefined;

    if (!chapterId) {
      return NextResponse.json(
        { success: false, error: 'Missing chapterId parameter' },
        { status: 400 }
      );
    }

    const result = await mangaService.fetchChapterPages(mangaId, chapterId, provider);

    // Rewrite page URLs through our proxy to handle Referer spoofing
    if (result.success && result.pages.length > 0) {
      const proxyOrigin = request.nextUrl.origin;
      const referer = result.headers?.Referer || '';

      result.pages = result.pages.map(page => ({
        ...page,
        url: `${proxyOrigin}/api/stream/proxy?url=${encodeURIComponent(page.url)}&referer=${encodeURIComponent(referer)}`,
      }));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /manga] Error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
