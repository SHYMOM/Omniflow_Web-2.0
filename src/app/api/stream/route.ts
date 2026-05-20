import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { ANIME, MOVIES, StreamingServers } from '@/lib/consumet';

// Standardized direct stream interfaces
interface StreamSubtitle {
  label: string;
  url: string;
  lang: string;
  default?: boolean;
}

interface DirectStreamResponse {
  success: boolean;
  source: 'direct' | 'iframe';
  url?: string;
  downloadUrl?: string;
  subtitles?: StreamSubtitle[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get('type') || 'anime';
    const id = searchParams.get('id') || '';
    const episode = Number(searchParams.get('episode') || '1');
    const season = Number(searchParams.get('season') || '1');

    if (!id) {
      return NextResponse.json({ success: false, source: 'iframe' }, { status: 400 });
    }

    const TMDB_KEY = process.env.TMDB_API_KEY || '52243a8565a58e657e3348126d400e9d';

    // ─── ANIME DIRECT LOCAL RESOLVER ──────────────────────────────────
    if (mediaType === 'anime') {
      let resolvedTitle = '';
      
      // Step A: Resolve anime title via AniList API (or MAL ID)
      try {
        const cleanId = id.replace('anilist-', '').replace('mal-', '');
        const variables = id.includes('mal') ? { idMal: Number(cleanId) } : { id: Number(cleanId) };
        const aniListQuery = `
          query ($id: Int, $idMal: Int) {
            Media(id: $id, idMal: $idMal, type: ANIME) {
              title { english romaji }
            }
          }
        `;
        const graphRes = await axios.post('https://graphql.anilist.co', {
          query: aniListQuery,
          variables
        }, { timeout: 3500 });
        
        const media = graphRes.data?.data?.Media;
        resolvedTitle = media?.title?.english || media?.title?.romaji || '';
      } catch (err) {
        console.warn('Anime direct stream: AniList title lookup timed out, trying search heuristics');
      }

      if (!resolvedTitle) {
        resolvedTitle = id.replace('anilist-', '').replace('mal-', '').replace(/-/g, ' ');
      }

      // Step B: Search & Extract via Gogoanime direct scraper
      try {
        const gogo = new ANIME.Gogoanime();
        const searchRes = await gogo.search(resolvedTitle);
        const matchedAnime = searchRes.results?.[0];

        if (matchedAnime?.id) {
          const info = await gogo.fetchAnimeInfo(matchedAnime.id);
          const targetEpisode = info.episodes?.find((ep: any) => ep.number === episode) || info.episodes?.[episode - 1];

          if (targetEpisode?.id) {
            // Cascade through servers starting with VidStreaming/GogoCDN
            const watchSources = await gogo.fetchEpisodeSources(targetEpisode.id, StreamingServers.VidStreaming)
              .catch(() => gogo.fetchEpisodeSources(targetEpisode.id, StreamingServers.GogoCDN))
              .catch(() => gogo.fetchEpisodeSources(targetEpisode.id, StreamingServers.StreamWish));

            const defaultSource = watchSources.sources.find((s: any) => s.isM3U8) || watchSources.sources[0];

            if (defaultSource?.url) {
              const subtitles: StreamSubtitle[] = (watchSources.subtitles || []).map((sub: any) => ({
                label: sub.lang || 'English',
                url: sub.url,
                lang: sub.lang?.toLowerCase().substring(0, 2) || 'en',
                default: sub.lang?.toLowerCase() === 'english' || sub.lang?.toLowerCase() === 'en'
              }));

              const watchReferer = watchSources.headers?.Referer || watchSources.headers?.referer || 'https://anitaku.pe/';
              const proxiedUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(defaultSource.url)}&referer=${encodeURIComponent(watchReferer)}`;

              return NextResponse.json<DirectStreamResponse>({
                success: true,
                source: 'direct',
                url: proxiedUrl,
                downloadUrl: watchSources.download || defaultSource.url,
                subtitles
              });
            }
          }
        }
      } catch (e) {
        console.warn('Anime direct local scraper failed:', e);
      }
    }

    // ─── MOVIES & TV DIRECT LOCAL RESOLVER ─────────────────────────────
    if (mediaType === 'movie' || mediaType === 'tv') {
      let resolvedTitle = '';
      const tmdbId = id.replace('tmdb-movie-', '').replace('tmdb-tv-', '');

      // Step A: Fetch title from TMDB API
      try {
        const tmdbRes = await axios.get(
          `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_KEY}`,
          { timeout: 3500 }
        );
        resolvedTitle = tmdbRes.data?.title || tmdbRes.data?.name || tmdbRes.data?.original_title || '';
      } catch (err) {
        console.warn('Movies/TV direct stream: TMDB title lookup failed');
      }

      if (resolvedTitle) {
        // Step B: Search & Extract via FlixHQ direct scraper
        try {
          const flixhq = new MOVIES.FlixHQ();
          const searchRes = await flixhq.search(resolvedTitle);
          const matchedMovie = searchRes.results?.find((item: any) => 
            mediaType === 'movie' ? item.type === 'movie' : item.type === 'tv'
          ) || searchRes.results?.[0];

          if (matchedMovie?.id) {
            const info = await flixhq.fetchMediaInfo(matchedMovie.id);
            const targetEpisode = mediaType === 'movie' 
              ? info.episodes?.[0]
              : info.episodes?.find((ep: any) => ep.season === season && ep.number === episode);

            if (targetEpisode?.id) {
              const watchSources = await flixhq.fetchEpisodeSources(targetEpisode.id, matchedMovie.id, StreamingServers.UpCloud)
                .catch(() => flixhq.fetchEpisodeSources(targetEpisode.id, matchedMovie.id, StreamingServers.VidCloud))
                .catch(() => flixhq.fetchEpisodeSources(targetEpisode.id, matchedMovie.id, StreamingServers.MixDrop));

              const defaultSource = watchSources.sources.find((s: any) => s.isM3U8) || watchSources.sources[0];

              if (defaultSource?.url) {
                const subtitles: StreamSubtitle[] = (watchSources.subtitles || []).map((sub: any) => ({
                  label: sub.lang || 'English',
                  url: sub.url,
                  lang: sub.lang?.toLowerCase().substring(0, 2) || 'en',
                  default: sub.lang?.toLowerCase() === 'english' || sub.lang?.toLowerCase() === 'en'
                }));

                const watchReferer = watchSources.headers?.Referer || watchSources.headers?.referer || 'https://flixhq.to/';
                const proxiedUrl = `${request.nextUrl.origin}/api/stream/proxy?url=${encodeURIComponent(defaultSource.url)}&referer=${encodeURIComponent(watchReferer)}`;

                return NextResponse.json<DirectStreamResponse>({
                  success: true,
                  source: 'direct',
                  url: proxiedUrl,
                  downloadUrl: defaultSource.url,
                  subtitles
                });
              }
            }
          }
        } catch (e) {
          console.warn('Movies/TV direct local scraper failed:', e);
        }
      }
    }

    // Default Fallback: Instruct Player to mount iframe sandbox cleanly
    return NextResponse.json<DirectStreamResponse>({
      success: false,
      source: 'iframe'
    });

  } catch (error) {
    console.error('Unified Direct Streaming API error:', error);
    return NextResponse.json<DirectStreamResponse>({
      success: false,
      source: 'iframe'
    }, { status: 500 });
  }
}
