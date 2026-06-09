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
    const imdbId = searchParams.get('imdbId') || undefined;

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
      langParam,
      imdbId || undefined
    );

    if (aggResult.success && aggResult.streams.length > 0) {
      // 1. Map and Proxy Video Streams (Bypass CORS/Referer constraints)
      const streams = aggResult.streams.map(stream => {
        const finalUrl = stream.video_url;
        let finalReferer = (stream as any).referer || '';
        
        if (finalReferer === 'https://vidapi.movie/' || finalUrl.includes('smartincomeplaybook.site')) {
          finalReferer = 'https://brightpathsignals.com/';
        }
        
        let proxiedUrl = finalUrl;
        if (!finalUrl.includes('/api/stream/proxy')) {
          if (!finalReferer) {
            // 1. Prioritize URL-based checks (most specific)
            if (finalUrl.includes('/pl/') || finalUrl.includes('/content/') || finalUrl.includes('boldvisionstrategy.site') || finalUrl.includes('cloudnestra.com') || finalUrl.includes('neonhorizonworkshops.com') || finalUrl.includes('wanderlynest.com') || finalUrl.includes('orchidpixelgardens.com') || finalUrl.includes('vsembed.ru') || finalUrl.includes('ecommerceprofitlab.site')) {
              finalReferer = 'https://cloudnestra.com/';
            } else if (finalUrl.includes('vidnest')) {
              finalReferer = 'https://vidnest.fun/';
            } else if (finalUrl.includes('animepahe')) {
              finalReferer = 'https://animepahe.com/';
            } else if (finalUrl.includes('allwish')) {
              finalReferer = 'https://allwish.me/';
            } else if (finalUrl.includes('gogoanime') || finalUrl.includes('empoweredfreelancerhub.site') || finalUrl.includes('vibeplayer')) {
              finalReferer = 'https://vibeplayer.site/';
            } else if (finalUrl.includes('vidapi') || finalUrl.includes('smartincomeplaybook.site')) {
              finalReferer = 'https://brightpathsignals.com/';
            } else if (finalUrl.includes('/cdnstr/') || finalUrl.includes('/static/') || finalUrl.includes('vidlink') || finalUrl.includes('tmstrd.justhd.tv')) {
              finalReferer = 'https://vidlink.pro/';
            }

            // 2. Fallback to source_name-based checks if URL pattern didn't match
            if (!finalReferer) {
              const sn = (stream.source_name || '').toLowerCase();
              if (sn.includes('vidsrc')) {
                finalReferer = 'https://cloudnestra.com/';
              } else if (sn.includes('vidnest')) {
                finalReferer = 'https://vidnest.fun/';
              } else if (sn.includes('vidapi')) {
                finalReferer = 'https://brightpathsignals.com/';
              } else if (sn.includes('vidlink')) {
                finalReferer = 'https://vidlink.pro/';
              } else if (sn.includes('animepahe')) {
                finalReferer = 'https://animepahe.com/';
              } else if (sn.includes('allwish')) {
                finalReferer = 'https://allwish.me/';
              } else if (sn.includes('gogoanime')) {
                finalReferer = 'https://gogoanime.cl/';
              }
            }
          }

          const extension = stream.video_type === 'm3u8' ? '&format=m3u8' : '&format=mp4';
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

    let tmdbId = id.includes('tmdb') ? id.replace('tmdb-movie-', '').replace('tmdb-tv-', '') : undefined;
    if (!tmdbId && imdbId) tmdbId = imdbId;

    if (tmdbId && (mediaType === 'movie' || mediaType === 'tv' || mediaType === 'kdrama')) {
      let iframeUrl = '';
      if (mediaType === 'movie') {
        iframeUrl = `https://vidsrc.cc/v2/embed/movie/${tmdbId}`;
      } else {
        iframeUrl = `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`;
      }
      return NextResponse.json<StreamApiResponse>({
        success: true,
        source: 'iframe',
        iframeUrl,
        provider: 'vidsrc',
      }, {
        headers: {
          'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
        }
      });
    }

    return NextResponse.json<StreamApiResponse>({
      success: false,
      source: 'direct'
    }, {
      headers: {
        'X-Stream-Resolve-Time': `${Date.now() - startTime}ms`
      }
    });

  } catch (error: any) {
    console.error('[API /stream] Unhandled service error:', error?.message || error);
    return NextResponse.json<StreamApiResponse>(
      { success: false, source: 'direct' },
      { status: 500 }
    );
  }
}
