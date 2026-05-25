import { NextRequest, NextResponse } from 'next/server';
import { AnimeExtractionService, MovieExtractionService } from '@/lib/extraction';
import type { IStreamResult, ExtractionContext } from '@/types/extraction-types';

// ─── Singleton service instances (reused across requests) ────
const animeService = new AnimeExtractionService();
const movieService = new MovieExtractionService();

// ─── Response interface (backward compatible with existing frontend) ─
interface StreamApiResponse {
  success: boolean;
  source: 'direct' | 'iframe';
  url?: string;
  downloadUrl?: string;
  subtitles?: Array<{
    label: string;
    url: string;
    lang: string;
    default?: boolean;
  }>;
  iframeUrl?: string;
  provider?: string;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  availableLanguages?: string[];
  isM3U8?: boolean;
}

/**
 * GET /api/stream
 *
 * Unified streaming endpoint. Delegates to AnimeExtractionService
 * or MovieExtractionService based on media type.
 *
 * Query params:
 *   - type:    'anime' | 'movie' | 'tv'
 *   - id:      Canonical media ID (e.g. 'anilist-21', 'tmdb-movie-550')
 *   - episode: Episode number (default 1)
 *   - season:  Season number (default 1, for TV only)
 *   - dubbed:  'true' | 'false' (for anime sub/dub preference)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type') || 'anime';
    const id = searchParams.get('id') || '';
    const episode = Number(searchParams.get('episode') || '1');
    const season = Number(searchParams.get('season') || '1');
    const isDubbed = searchParams.get('dubbed') === 'true';
    const lang = searchParams.get('lang') || 'sub';

    if (!id) {
      return NextResponse.json<StreamApiResponse>(
        { success: false, source: 'iframe' },
        { status: 400 }
      );
    }

    let streamResult: IStreamResult;

    // ─── ANIME ─────────────────────────────────────────────
    if (mediaType === 'anime') {
      // Resolve title first
      const title = await animeService.resolveTitle(id);

      const ctx: ExtractionContext = {
        mediaId: id,
        title,
        episode,
        mediaType: 'anime',
        isDubbed,
        language: lang,
      };

      streamResult = await animeService.extractSources(ctx);
    }
    // ─── MOVIES & TV ───────────────────────────────────────
    else if (mediaType === 'movie' || mediaType === 'tv') {
      const resolved = await movieService.resolveTitle(id, mediaType as 'movie' | 'tv');

      const ctx: ExtractionContext = {
        mediaId: id,
        title: resolved.title,
        episode,
        season,
        mediaType: mediaType as 'movie' | 'tv',
        language: lang,
      };

      streamResult = await movieService.extractSources(ctx);
    }
    // ─── UNKNOWN TYPE ──────────────────────────────────────
    else {
      return NextResponse.json<StreamApiResponse>({
        success: false,
        source: 'iframe',
      });
    }

    // ─── FORMAT RESPONSE ───────────────────────────────────

    if (streamResult.success && streamResult.sources.length > 0) {
      // Find best source (prefer .m3u8)
      const defaultSource =
        streamResult.sources.find(s => s.isM3U8) || streamResult.sources[0];

      // Proxy the source URL through our stream proxy
      const referer = streamResult.headers?.Referer || '';
      const extension = defaultSource.isM3U8 ? '&ext=.m3u8' : '&ext=.mp4';
      const proxiedUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(defaultSource.url)}&referer=${encodeURIComponent(referer)}${extension}`;

      // Map subtitles to response format
      const subtitles = streamResult.subtitles.map(sub => ({
        label: sub.label,
        url: sub.url,
        lang: sub.lang,
        default: sub.default,
      }));

      return NextResponse.json<StreamApiResponse>({
        success: true,
        source: 'direct',
        url: proxiedUrl,
        downloadUrl: streamResult.download || defaultSource.url,
        subtitles,
        provider: streamResult.provider,
        intro: streamResult.intro,
        outro: streamResult.outro,
        availableLanguages: streamResult.availableLanguages,
        isM3U8: defaultSource.isM3U8,
      });
    }

    // ─── FALLBACK TO IFRAME ────────────────────────────────

    // If we have a VidSrc iframe URL, return it
    if (streamResult.iframeUrl) {
      return NextResponse.json<StreamApiResponse>({
        success: false,
        source: 'iframe',
        iframeUrl: streamResult.iframeUrl,
        provider: streamResult.provider,
      });
    }

    // Default fallback
    return NextResponse.json<StreamApiResponse>({
      success: false,
      source: 'iframe',
    });
  } catch (error: any) {
    console.error('[API /stream] Error:', error?.message || error);
    return NextResponse.json<StreamApiResponse>(
      { success: false, source: 'iframe' },
      { status: 500 }
    );
  }
}
