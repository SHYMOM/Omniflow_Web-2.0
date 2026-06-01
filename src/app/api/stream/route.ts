import { NextRequest, NextResponse } from 'next/server';
import { UniversalAggregatorService } from '@/lib/extraction/universal-aggregator.service';

const universalAggregator = new UniversalAggregatorService();

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
  availableStreams?: Array<{ language: string; sourceUrl: string; type: 'm3u8' | 'mp4' }>;
}

/**
 * GET /api/stream
 *
 * Unified streaming endpoint. Delegates to UniversalAggregatorService
 * which handles query expansion, parallel scraping, and Supabase caching.
 *
 * Query params:
 *   - type:    'anime' | 'movie' | 'tv' | 'kdrama'
 *   - id:      Canonical media ID (e.g. 'anilist-21', 'tmdb-movie-550')
 *   - episode: Episode number (default 1)
 *   - season:  Season number (default 1, for TV only)
 *   - dubbed:  'true' | 'false' (for anime sub/dub preference)
 *   - lang:    'sub' | 'eng-dub' | 'hin-dub' (specific language track request)
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
    const langParam = searchParams.get('lang') || 'sub';

    if (!id) {
      return NextResponse.json<StreamApiResponse>(
        { success: false, source: 'iframe' },
        { status: 400 }
      );
    }

    if (mediaType !== 'anime' && mediaType !== 'movie' && mediaType !== 'tv' && mediaType !== 'kdrama') {
      return NextResponse.json<StreamApiResponse>({
        success: false,
        source: 'iframe',
      });
    }

    // Resolve streams from the aggregation and caching engine
    const aggResult = await universalAggregator.aggregate(
      id,
      mediaType as any,
      season,
      episode,
      langParam
    );

    if (aggResult.success && aggResult.streams.length > 0) {
      // 1. Map and Proxy Video Streams (Bypass CORS/Referer constraints)
      const streams = aggResult.streams.map(stream => {
        const finalUrl = stream.video_url;
        let finalReferer = (stream as any).referer || '';
        
        let proxiedUrl = finalUrl;
        if (!finalUrl.includes('/api/stream/proxy')) {
          if (!finalReferer) {
            const sn = (stream.source_name || '').toLowerCase();
            if (sn.includes('vidsrc')) {
              finalReferer = 'https://cloudnestra.com/';
            } else if (sn.includes('vidnest')) {
              finalReferer = 'https://vidnest.fun/';
            } else if (sn.includes('vidapi')) {
              finalReferer = 'https://vidapi.movie/';
            } else if (sn.includes('vidlink')) {
              finalReferer = 'https://vidlink.pro/';
            } else if (sn.includes('animepahe')) {
              finalReferer = 'https://animepahe.com/';
            } else if (sn.includes('allwish')) {
              finalReferer = 'https://allwish.me/';
            } else if (sn.includes('gogoanime')) {
              finalReferer = 'https://gogoanime.cl/';
            }
            // Fallback to URL-based checks if source_name didn't match
            if (!finalReferer) {
              if (finalUrl.includes('boldvisionstrategy.site') || finalUrl.includes('cloudnestra.com') || finalUrl.includes('neonhorizonworkshops.com') || finalUrl.includes('wanderlynest.com') || finalUrl.includes('orchidpixelgardens.com') || finalUrl.includes('vsembed.ru') || finalUrl.includes('ecommerceprofitlab.site')) {
                finalReferer = 'https://cloudnestra.com/';
              } else if (finalUrl.includes('vidnest')) {
                finalReferer = 'https://vidnest.fun/';
              } else if (finalUrl.includes('animepahe')) {
                finalReferer = 'https://animepahe.com/';
              } else if (finalUrl.includes('allwish')) {
                finalReferer = 'https://allwish.me/';
              } else if (finalUrl.includes('gogoanime')) {
                finalReferer = 'https://gogoanime.cl/';
              } else if (finalUrl.includes('vidapi')) {
                finalReferer = 'https://vidapi.movie/';
              } else if (finalUrl.includes('vidlink') || finalUrl.includes('tmstrd.justhd.tv')) {
                finalReferer = 'https://vidlink.pro/';
              }
            }
          }

          const extension = stream.video_type === 'm3u8' ? '&ext=.m3u8' : '&ext=.mp4';
          proxiedUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(finalUrl)}&referer=${encodeURIComponent(finalReferer)}${extension}`;
        }

        return {
          language: stream.language, // 'eng-dub' | 'hin-dub' | 'sub'
          sourceUrl: proxiedUrl,
          type: stream.video_type
        };
      });

      // 2. Map and Proxy Subtitles
      const subtitles = aggResult.subtitles.map(sub => {
        const subUrl = sub.url;
        let proxySubUrl = subUrl;
        
        if (!subUrl.includes('/api/stream/proxy')) {
          proxySubUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(subUrl)}&type=sub`;
        }

        return {
          label: sub.label,
          url: proxySubUrl,
          lang: sub.lang,
          default: sub.default || false
        };
      });

      // 3. Select Target Stream based on requested language
      let targetLang = langParam;
      if (targetLang === 'eng' || targetLang === 'dub') targetLang = 'eng-dub';
      if (targetLang === 'hin') targetLang = 'hin-dub';

      // Fallback chain: requested -> sub -> eng-dub -> hin-dub -> first available
      const fallbackLangs = [targetLang, 'sub', 'eng-dub', 'hin-dub'];
      let selectedStream = streams.find(s => s.language === targetLang);

      if (!selectedStream) {
        for (const fallback of fallbackLangs) {
          selectedStream = streams.find(s => s.language === fallback);
          if (selectedStream) break;
        }
      }

      if (!selectedStream) {
        selectedStream = streams[0];
      }

      const availableLanguages = Array.from(new Set(streams.map(s => s.language)));

      return NextResponse.json<StreamApiResponse>({
        success: true,
        source: 'direct',
        url: selectedStream.sourceUrl,
        downloadUrl: selectedStream.sourceUrl,
        subtitles,
        provider: selectedStream.language,
        availableLanguages,
        availableStreams: streams,
        isM3U8: selectedStream.type === 'm3u8'
      }, {
        headers: {
          'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    // ─── FALLBACK TO EMBED IFRAMES ─────────────────────────────
    const cleanId = id
      .replace('tmdb-movie-', '')
      .replace('tmdb-tv-', '')
      .replace('anilist-', '')
      .replace('mal-', '');

    let iframeUrl = '';
    const fallbackIframes: { name: string, url: string }[] = [];

    if (mediaType === 'movie') {
      iframeUrl = `https://vidsrc.net/embed/movie?tmdb=${cleanId}`;
      fallbackIframes.push(
        { name: 'VidSrc.to', url: `https://vidsrc.to/embed/movie/${cleanId}` },
        { name: 'VidSrc.me', url: `https://vidsrc.me/embed/movie/${cleanId}` },
        { name: 'VidSrc.cc', url: `https://vidsrc.cc/v2/embed/movie/${cleanId}` },
        { name: 'Embed.su', url: `https://embed.su/embed/movie/${cleanId}` }
      );
    } else if (mediaType === 'tv') {
      iframeUrl = `https://vidsrc.net/embed/tv?tmdb=${cleanId}&season=${season}&episode=${episode}`;
      fallbackIframes.push(
        { name: 'VidSrc.to', url: `https://vidsrc.to/embed/tv/${cleanId}/${season}/${episode}` },
        { name: 'VidSrc.me', url: `https://vidsrc.me/embed/tv/${cleanId}/${season}/${episode}` },
        { name: 'VidSrc.cc', url: `https://vidsrc.cc/v2/embed/tv/${cleanId}/${season}/${episode}` },
        { name: 'Embed.su', url: `https://embed.su/embed/tv/${cleanId}/${season}/${episode}` }
      );
    } else if (mediaType === 'anime') {
      iframeUrl = `https://vidsrc.net/embed/anime?tmdb=${cleanId}&ep=${episode}`;
      fallbackIframes.push(
        { name: 'VidSrc.to', url: `https://vidsrc.to/embed/anime/${cleanId}/${episode}` },
        { name: 'VidSrc.me', url: `https://vidsrc.me/embed/anime/${cleanId}/${episode}` },
        { name: 'VidSrc.cc', url: `https://vidsrc.cc/v2/embed/anime/${cleanId}/${episode}` }
      );
    }

    return NextResponse.json<StreamApiResponse>({
      success: false,
      source: 'iframe',
      iframeUrl: iframeUrl || undefined,
      availableStreams: fallbackIframes as any // Pass fallback iframes to the frontend just in case
    }, {
      headers: {
        'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
      }
    });

  } catch (error: any) {
    console.error('[API /stream] Unhandled service error:', error?.message || error);
    return NextResponse.json<StreamApiResponse>(
      { success: false, source: 'iframe' },
      { status: 500 }
    );
  }
}
