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
  audioTracks?: Array<{ language: string; label: string; default?: boolean }>;
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
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type') || 'anime';
    const id = searchParams.get('id') || '';
    const parsedEpisode = parseInt(searchParams.get('episode') || '1', 10);
    const episode = isNaN(parsedEpisode) ? 1 : parsedEpisode;
    const parsedSeason = parseInt(searchParams.get('season') || '1', 10);
    const season = isNaN(parsedSeason) ? 1 : parsedSeason;
    const isDubbed = searchParams.get('dubbed') === 'true';
    const lang = searchParams.get('lang') || 'sub';
    const titleParam = searchParams.get('title') || '';

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
      const title = titleParam || await animeService.resolveTitle(id);

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
        title: titleParam || resolved.title,
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

      let finalUrl = defaultSource.url;
      let finalReferer = streamResult.headers?.Referer || '';
      
      // Extract real URL if wrapped in OMSS proxy format
      if (finalUrl.includes('/v1/proxy?data=')) {
        try {
          const urlObj = new URL(finalUrl.startsWith('http') ? finalUrl : `http://localhost${finalUrl}`);
          const dataParam = urlObj.searchParams.get('data');
          if (dataParam) {
            const parsed = JSON.parse(dataParam);
            if (parsed.url) finalUrl = parsed.url;
            if (parsed.headers?.Referer) finalReferer = parsed.headers.Referer;
          }
        } catch(e) {}
      }

      // Proxy the source URL through our stream proxy
      let proxiedUrl = finalUrl;
      if (!finalUrl.includes('/api/stream/proxy')) {
        const extension = defaultSource.isM3U8 ? '&ext=.m3u8' : '&ext=.mp4';
        proxiedUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(finalUrl)}&referer=${encodeURIComponent(finalReferer)}${extension}`;
      } else if (finalUrl.startsWith('/')) {
        proxiedUrl = `${request.nextUrl.origin}${finalUrl}`;
      }

      // Fetch external subtitles
      try {
        const { fetchExternalSubtitles } = await import('@/lib/extraction/subtitle.service');
        let tmdbId = '';
        if (id.startsWith('tmdb-movie-')) tmdbId = id.replace('tmdb-movie-', '');
        else if (id.startsWith('tmdb-tv-')) tmdbId = id.replace('tmdb-tv-', '');
        else if (mediaType === 'anime') {
          const mapped = await animeService.mapIds(id);
          tmdbId = mapped.tmdbId || '';
        }
        
        if (tmdbId) {
           const extSubs = await fetchExternalSubtitles(tmdbId, mediaType as any, season, episode);
           if (!streamResult.subtitles) streamResult.subtitles = [];
           extSubs.forEach(ext => {
              streamResult.subtitles.push({
                 label: ext.label,
                 lang: ext.lang,
                 url: ext.url,
                 default: false
              });
           });
        }
      } catch (err) {
        console.error('Failed to fetch external subs in route:', err);
      }

      // Map subtitles to response format
      const subtitles = (streamResult.subtitles || []).map(sub => {
        let subUrl = sub.url;
        let subReferer = '';
        if (subUrl.includes('/v1/proxy?data=')) {
          try {
            const urlObj = new URL(subUrl.startsWith('http') ? subUrl : `http://localhost${subUrl}`);
            const dataParam = urlObj.searchParams.get('data');
            if (dataParam) {
              const parsed = JSON.parse(dataParam);
              if (parsed.url) subUrl = parsed.url;
              if (parsed.headers?.Referer) subReferer = parsed.headers.Referer;
            }
          } catch(e) {}
        }
        
        // Proxy subtitle URLs as well to avoid CORS issues
        let proxySubUrl = subUrl;
        if (!subUrl.includes('/api/stream/proxy')) {
          proxySubUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(subUrl)}&referer=${encodeURIComponent(subReferer)}&type=sub`;
        } else if (subUrl.startsWith('/')) {
          proxySubUrl = `${request.nextUrl.origin}${subUrl}`;
        }
        
        return {
          label: sub.label,
          url: proxySubUrl,
          lang: sub.lang,
          default: sub.default,
        };
      });

      return NextResponse.json<StreamApiResponse>({
        success: true,
        source: 'direct',
        url: proxiedUrl,
        downloadUrl: streamResult.download || finalUrl,
        subtitles,
        provider: streamResult.provider,
        intro: streamResult.intro,
        outro: streamResult.outro,
        availableLanguages: streamResult.availableLanguages,
        audioTracks: streamResult.audioTracks,
        isM3U8: defaultSource.isM3U8,
      }, {
        headers: {
          'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
        }
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
      }, {
        headers: {
          'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    // Default fallback
    return NextResponse.json<StreamApiResponse>({
      success: false,
      source: 'iframe',
    }, {
      headers: {
        'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
      }
    });
  } catch (error: any) {
    console.error('[API /stream] Error:', error?.message || error);
    return NextResponse.json<StreamApiResponse>(
      { success: false, source: 'iframe' },
      { status: 500 }
    );
  }
}
