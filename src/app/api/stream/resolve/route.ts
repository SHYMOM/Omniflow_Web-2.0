import { NextRequest, NextResponse } from 'next/server';
import { UniversalAggregatorService } from '@/lib/extraction/universal-aggregator.service';
import { EphemeralCache } from '@/lib/cache/ephemeral-cache';

const universalAggregator = new UniversalAggregatorService();

interface StreamSource {
  language: string;
  url: string;
  type: 'm3u8' | 'mp4';
}

interface SubtitleSource {
  language: string;
  url: string;
  label: string;
}

interface StreamPayload {
  video_sources: StreamSource[];
  subtitle_sources: SubtitleSource[];
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type') || 'anime';
    const id = searchParams.get('id') || '';
    const episode = parseInt(searchParams.get('episode') || '1', 10) || 1;
    const season = parseInt(searchParams.get('season') || '1', 10) || 1;
    const langParam = searchParams.get('lang') || 'sub';
    const imdbId = searchParams.get('imdbId') || undefined;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing canonical media ID' },
        { status: 400 }
      );
    }

    if (!['anime', 'movie', 'tv', 'kdrama'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'Invalid media type' },
        { status: 400 }
      );
    }

    const episodeKey = `S${season}E${episode}_${langParam}`;

    // 1. Check Ephemeral Cache
    const cachedPayload = await EphemeralCache.get(id, episodeKey);
    if (cachedPayload) {
      return NextResponse.json(cachedPayload, {
        headers: {
          'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`,
          'X-Cache': 'HIT'
        }
      });
    }

    // Call the unified parallel extraction engine
    const aggResult = await universalAggregator.aggregate(
      id,
      mediaType as any,
      season,
      episode,
      langParam,
      imdbId
    );

    if (aggResult.success && aggResult.streams.length > 0) {
      // Map streams strictly to StreamSource
      const video_sources: StreamSource[] = aggResult.streams.map(stream => {
        let finalUrl = stream.video_url;
        let referer = stream.referer || '';

        // Proxy fallback for CORS restrictions
        if (!finalUrl.includes('/api/stream/proxy')) {
          if (!referer && stream.source_name.includes('vidsrc')) {
            referer = 'https://cloudnestra.com/';
          } else if (!referer && stream.source_name.includes('vidnest')) {
            referer = 'https://vidnest.fun/';
          }
          
          const extension = stream.video_type === 'm3u8' ? '&format=m3u8' : '&format=mp4';
          finalUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(finalUrl)}&referer=${encodeURIComponent(referer)}${extension}`;
        }

        return {
          language: stream.language,
          url: finalUrl,
          type: stream.video_type
        };
      });

      // Map subtitles strictly to SubtitleSource (finding subtitles as requested by user)
      const subtitle_sources: SubtitleSource[] = aggResult.subtitles.map(sub => {
        let proxySubUrl = sub.url;
        if (!proxySubUrl.includes('/api/stream/proxy')) {
          proxySubUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(proxySubUrl)}&type=sub`;
        }
        return {
          language: sub.lang,
          url: proxySubUrl,
          label: sub.label
        };
      });

      const payload: StreamPayload = {
        video_sources,
        subtitle_sources
      };

      // Set Ephemeral Cache
      await EphemeralCache.set(id, episodeKey, payload);

      return NextResponse.json(payload, {
        headers: {
          'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    // No direct streams found, return empty array (client will fallback to iframe)
    return NextResponse.json<StreamPayload>({
      video_sources: [],
      subtitle_sources: []
    }, { status: 404 });

  } catch (error: any) {
    console.error('[API /stream/resolve] Unhandled service error:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error resolving stream' },
      { status: 500 }
    );
  }
}
