import { NextRequest, NextResponse } from 'next/server';
import { UniversalAggregatorService } from '@/lib/extraction/universal-aggregator.service';

const universalAggregator = new UniversalAggregatorService();

function formatStreamUrls(streams: any[], request: NextRequest) {
  return streams.map(stream => {
    const finalUrl = stream.video_url || stream.sourceUrl;
    let finalReferer = stream.referer || '';
    
    if (finalReferer === 'https://vidapi.movie/' || finalUrl.includes('smartincomeplaybook.site')) {
      finalReferer = 'https://brightpathsignals.com/';
    }
    
    let proxiedUrl = finalUrl;
    if (!finalUrl.includes('/api/stream/proxy')) {
      if (!finalReferer) {
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

        if (!finalReferer) {
          const sn = (stream.source_name || stream.provider || '').toLowerCase();
          if (sn.includes('vidsrc')) finalReferer = 'https://cloudnestra.com/';
          else if (sn.includes('vidnest')) finalReferer = 'https://vidnest.fun/';
          else if (sn.includes('vidapi')) finalReferer = 'https://brightpathsignals.com/';
          else if (sn.includes('vidlink')) finalReferer = 'https://vidlink.pro/';
          else if (sn.includes('animepahe')) finalReferer = 'https://animepahe.com/';
          else if (sn.includes('allwish')) finalReferer = 'https://allwish.me/';
          else if (sn.includes('gogoanime')) finalReferer = 'https://gogoanime.cl/';
        }
      }

      const extension = (stream.video_type || stream.type) === 'm3u8' ? '&format=m3u8' : '&format=mp4';
      proxiedUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(finalUrl)}&referer=${encodeURIComponent(finalReferer)}${extension}`;
    }

    return {
      language: stream.language,
      sourceUrl: proxiedUrl,
      type: stream.video_type || stream.type,
      originalUrl: finalUrl
    };
  });
}

function formatSubtitleUrls(subtitles: any[], request: NextRequest) {
  return subtitles.map(sub => {
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
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mediaType = searchParams.get('type') || 'anime';
  const id = searchParams.get('id') || '';
  const parsedEpisode = parseInt(searchParams.get('episode') || '1', 10);
  const episode = isNaN(parsedEpisode) ? 1 : parsedEpisode;
  const parsedSeason = parseInt(searchParams.get('season') || '1', 10);
  const season = isNaN(parsedSeason) ? 1 : parsedSeason;
  const langParam = searchParams.get('lang') || 'sub';
  const imdbId = searchParams.get('imdbId') || undefined;

  if (!id) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent('init', 'Resolving premium streams...');

        const aggResult = await universalAggregator.aggregate(
          id,
          mediaType as any,
          season,
          episode,
          langParam,
          imdbId || undefined,
          (eventName, data) => {
            if (eventName === 'provider_success' && data.streams) {
              const formatted = formatStreamUrls(data.streams, request);
              sendEvent('provider_success', { provider: data.provider, streams: formatted });
            } else {
              sendEvent(eventName, data);
            }
          }
        );

        if (aggResult.success && aggResult.streams.length > 0) {
          const formattedStreams = formatStreamUrls(aggResult.streams, request);
          const formattedSubs = formatSubtitleUrls(aggResult.subtitles, request);

          let targetLang = langParam;
          if (targetLang === 'eng' || targetLang === 'dub') targetLang = 'eng-dub';
          if (targetLang === 'hin') targetLang = 'hin-dub';

          const fallbackLangs = [targetLang, 'sub', 'eng-dub', 'hin-dub'];
          let selectedStream = formattedStreams.find(s => s.language === targetLang);

          if (!selectedStream) {
            for (const fallback of fallbackLangs) {
              selectedStream = formattedStreams.find(s => s.language === fallback);
              if (selectedStream) break;
            }
          }

          if (!selectedStream) {
            selectedStream = formattedStreams[0];
          }

          const availableLanguages = Array.from(new Set(formattedStreams.map(s => s.language)));

          sendEvent('done', {
            success: true,
            source: 'direct',
            url: selectedStream.sourceUrl,
            downloadUrl: selectedStream.sourceUrl,
            subtitles: formattedSubs,
            provider: selectedStream.language,
            availableLanguages,
            availableStreams: formattedStreams,
            isM3U8: selectedStream.type === 'm3u8'
          });
        } else {
          // Fallback to iframe
          let tmdbId = id.includes('tmdb') ? id.replace('tmdb-movie-', '').replace('tmdb-tv-', '') : undefined;
          if (!tmdbId && imdbId) tmdbId = imdbId;

          if (tmdbId && (mediaType === 'movie' || mediaType === 'tv' || mediaType === 'kdrama')) {
            const iframeUrl = mediaType === 'movie' 
              ? `https://vidsrc.cc/v2/embed/movie/${tmdbId}`
              : `https://vidsrc.cc/v2/embed/tv/${tmdbId}/${season}/${episode}`;
              
            sendEvent('done', {
              success: true,
              source: 'iframe',
              iframeUrl,
              provider: 'vidsrc',
            });
          } else {
            sendEvent('done', { success: false, source: 'direct' });
          }
        }
      } catch (err: any) {
        console.error('[SSE /stream] Error:', err);
        sendEvent('error', { message: err.message || 'Stream resolution failed' });
        sendEvent('done', { success: false });
      } finally {
        controller.close();
      }
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
