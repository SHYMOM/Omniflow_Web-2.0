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
  iframeUrl?: string;
  allIframeUrls?: { name: string; url: string }[];
}

// Iframe embed providers (same order as SSE endpoint)
const embedProviders = [
  { name: 'vidsrc.xyz', buildMovieUrl: (tmdbId: string) => `https://vidsrc.xyz/embed/movie/${tmdbId}`, buildTvUrl: (tmdbId: string, season: number, episode: number) => `https://vidsrc.xyz/embed/tv/${tmdbId}/${season}/${episode}` },
  { name: 'vidsrc.to', buildMovieUrl: (tmdbId: string) => `https://vidsrc.to/embed/movie/${tmdbId}`, buildTvUrl: (tmdbId: string, season: number, episode: number) => `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}` },
  { name: 'embed.su', buildMovieUrl: (tmdbId: string) => `https://embed.su/embed/movie/${tmdbId}`, buildTvUrl: (tmdbId: string, season: number, episode: number) => `https://embed.su/embed/tv/${tmdbId}/${season}/${episode}` },
  { name: 'multiembed.mov', buildMovieUrl: (tmdbId: string) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`, buildTvUrl: (tmdbId: string, season: number, episode: number) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}` },
  { name: 'vidsrc.cc', buildMovieUrl: (tmdbId: string) => `https://vidsrc.cc/v2/embed/movie/${tmdbId}`, buildTvUrl: (tmdbId: string, season: number, episode: number) => `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}` },
];

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

    // No direct streams found — fall back to iframe embeds
    // First try to resolve a TMDB ID for non-TMDB IDs (e.g. anime)
    let tmdbId: string | null = null;
    if (id.startsWith('tmdb-movie-')) tmdbId = id.replace('tmdb-movie-', '');
    else if (id.startsWith('tmdb-tv-')) tmdbId = id.replace('tmdb-tv-', '');
    else {
      try {
        const { IdSyncService } = await import('@/lib/extraction/id-sync.service');
        const resolved = await IdSyncService.resolveTmdbId(id);
        tmdbId = resolved.tmdbId;
      } catch {}
    }

    const embedId = tmdbId || imdbId || '';
    const isTv = mediaType === 'tv' || mediaType === 'anime' || mediaType === 'kdrama';
    const allIframeUrls = embedId ? embedProviders.map(p => ({
      name: p.name,
      url: isTv ? p.buildTvUrl(embedId, season, episode) : p.buildMovieUrl(embedId)
    })) : [];

    return NextResponse.json({
      video_sources: [],
      subtitle_sources: [],
      iframeUrl: allIframeUrls.length > 0 ? allIframeUrls[0].url : undefined,
      allIframeUrls: allIframeUrls.length > 0 ? allIframeUrls : undefined,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API /stream/resolve] Unhandled service error:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error resolving stream' },
      { status: 500 }
    );
  }
}
