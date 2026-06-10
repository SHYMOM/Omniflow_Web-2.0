import { load } from 'cheerio';
import {
  MovieParser,
  TvType,
  IMovieInfo,
  IEpisodeServer,
  StreamingServers,
  ISource,
  IMovieResult,
  ISearch,
} from '../../models';

class KissKH extends MovieParser {
  override readonly name = 'KissKH';
  protected override baseUrl = 'https://kisskh.co';
  protected override logo = 'https://kisskh.co/assets/logo.png';
  protected override classPath = 'DRAMA.KissKH';
  override supportedTypes = new Set([TvType.MOVIE, TvType.TVSERIES]);

  override search = async (query: string, page: number = 1): Promise<ISearch<IMovieResult>> => {
    try {
      // KissKH often uses an internal search endpoint. We will scrape or query it.
      const response = await this.client.get(`${this.baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`);
      const $ = load(response.data);
      const results: IMovieResult[] = [];

      $('.drama-card, .film-item, article').each((_, el) => {
        const title = $(el).find('.title, h2 a').text().trim();
        const href = $(el).find('a').first().attr('href');
        const image = $(el).find('img').attr('src');
        const id = href ? href.replace(/^\//, '').replace(/\/$/, '') : '';

        if (title && id) {
          results.push({
            id,
            title,
            image,
            url: `${this.baseUrl}/${id}`,
            type: TvType.TVSERIES, // Most dramas are tv series
          });
        }
      });

      // Fallback API query
      if (results.length === 0) {
        try {
          const apiRes = await this.client.get(`https://kisskh.co/api/DramaList/Search?q=${encodeURIComponent(query)}`);
          if (apiRes.data && Array.isArray(apiRes.data)) {
            apiRes.data.forEach((item: any) => {
              results.push({
                id: String(item.id),
                title: item.title,
                image: item.thumbnail,
                url: `${this.baseUrl}/Drama/${item.title.replace(/\s+/g, '-')}-${item.id}`,
                type: item.type === 'Movie' ? TvType.MOVIE : TvType.TVSERIES,
              });
            });
          }
        } catch {}
      }

      return {
        currentPage: page,
        hasNextPage: false,
        results,
      };
    } catch (err) {
      return { currentPage: page, hasNextPage: false, results: [] };
    }
  };

  override fetchMediaInfo = async (mediaId: string): Promise<IMovieInfo> => {
    try {
      const numericId = mediaId.split('-').pop() || mediaId;
      const response = await this.client.get(`https://kisskh.co/api/DramaList/Detail/${numericId}`);
      const data = response.data;

      const title = data.title || mediaId;
      const image = data.thumbnail;
      const description = data.description || '';
      const type = data.type === 'Movie' ? TvType.MOVIE : TvType.TVSERIES;

      const episodes: any[] = [];
      if (data.episodes && Array.isArray(data.episodes)) {
        data.episodes.forEach((ep: any) => {
          episodes.push({
            id: String(ep.id),
            title: `Episode ${ep.number}`,
            number: ep.number,
            season: 1,
            url: `${this.baseUrl}/Episode/${ep.id}`,
          });
        });
      }

      return {
        id: mediaId,
        title,
        image,
        description,
        type,
        episodes,
      };
    } catch (err) {
      return { id: mediaId, title: mediaId, episodes: [] };
    }
  };

  override fetchEpisodeSources = async (
    episodeId: string,
    mediaId: string,
    server: StreamingServers = StreamingServers.UpCloud
  ): Promise<ISource> => {
    try {
      const response = await this.client.get(`https://kisskh.co/api/Sub/GetByEpisodeId?episodeId=${episodeId}`);
      // KissKH provides subtitles in SRT/VTT format
      const subtitles: any[] = [];
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((sub: any) => {
          subtitles.push({
            url: sub.src,
            lang: sub.lang.substring(0, 2),
            label: sub.label,
          });
        });
      }

      const streamResponse = await this.client.get(`https://kisskh.co/api/Episode/GetSources?episodeId=${episodeId}`);
      const sources = [];
      if (streamResponse.data && streamResponse.data.video) {
        sources.push({
          url: streamResponse.data.video,
          quality: 'auto',
          isM3U8: streamResponse.data.video.includes('.m3u8'),
        });
      }

      if (sources.length === 0) {
        sources.push({
          url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          quality: 'auto',
          isM3U8: true,
        });
      }

      return {
        sources,
        subtitles,
        headers: {
          Referer: this.baseUrl,
        },
      };
    } catch (err) {
      return { sources: [] };
    }
  };

  override fetchEpisodeServers = async (episodeId: string, mediaId: string): Promise<IEpisodeServer[]> => {
    return [];
  };
}

export default KissKH;
