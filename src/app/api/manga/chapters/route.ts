import { NextRequest, NextResponse } from 'next/server';
import { MangaExtractionService } from '@/lib/extraction';

const mangaService = new MangaExtractionService();

/**
 * GET /api/manga/chapters
 *
 * Fetch the chapter list for a manga.
 *
 * Query params:
 *   - mangaId:  MangaDex manga UUID
 *   - provider: (optional) 'mangadex' — defaults to mangadex
 *
 * Returns: IMangaChapterListResult JSON
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mangaId = searchParams.get('mangaId') || '';
    const provider = searchParams.get('provider') || 'mangadex';

    if (!mangaId) {
      return NextResponse.json(
        { success: false, error: 'Missing mangaId parameter' },
        { status: 400 }
      );
    }

    const result = await mangaService.fetchChapterList(mangaId, provider);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API /manga/chapters] Error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
