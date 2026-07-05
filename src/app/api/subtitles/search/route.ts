import { NextRequest, NextResponse } from 'next/server';
import { SubtitleService } from '@/lib/extraction/subtitle.service';

const ALLOWED_LANGS = ['en', 'hi', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ru', 'ar', 'pt', 'it'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get('tmdbId');
    const imdbId = searchParams.get('imdbId');
    const title = searchParams.get('title');
    const season = searchParams.get('season') ? parseInt(searchParams.get('season')!) : undefined;
    const episode = searchParams.get('episode') ? parseInt(searchParams.get('episode')!) : undefined;
    const languages = searchParams.get('langs')?.split(',').filter(Boolean) || ALLOWED_LANGS;

    const subs = await SubtitleService.searchOpenSubtitles({
      tmdbId: tmdbId || undefined,
      imdbId: imdbId || undefined,
      title: title || undefined,
      season,
      episode,
      languages,
    });

    // Also try SubDL as fallback
    let subdlSubs: any[] = [];
    if (tmdbId && season && episode) {
      subdlSubs = await SubtitleService.searchSubDL({
        tmdbId,
        season,
        episode,
        languages,
      });
    }

    const allSubs = [...subs, ...subdlSubs];
    const seen = new Set<string>();
    const deduped = allSubs.filter(s => {
      if (seen.has(s.lang)) return false;
      seen.add(s.lang);
      return true;
    });

    return NextResponse.json({ subtitles: deduped });
  } catch (error: any) {
    console.error('[API /subtitles/search] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to search subtitles' }, { status: 500 });
  }
}
