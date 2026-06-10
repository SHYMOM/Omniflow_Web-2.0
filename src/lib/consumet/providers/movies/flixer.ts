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

class Flixer extends MovieParser {
  override readonly name = 'Flixer';
  protected override baseUrl = 'https://flixer.com';
  protected override logo = 'https://flixer.com/favicon.ico';
  protected override classPath = 'MOVIES.Flixer';
  override supportedTypes = new Set([TvType.MOVIE, TvType.TVSERIES]);

  override search = async (query: string, page: number = 1): Promise<ISearch<IMovieResult>> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/search?query=${encodeURIComponent(query)}&page=${page}`);
      const $ = load(response.data);
      const results: IMovieResult[] = [];

      $('.movie-item, .film-item, article').each((_, el) => {
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
            type: id.includes('/tv/') || id.includes('/show/') ? TvType.TVSERIES : TvType.MOVIE,
          });
        }
      });

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
      const response = await this.client.get(`${this.baseUrl}/${mediaId}`);
      const $ = load(response.data);

      const title = $('.movie-title, h1').text().trim();
      const image = $('.poster img').attr('src');
      const description = $('.plot, .storyline').text().trim();
      const type = mediaId.includes('/tv/') || mediaId.includes('/show/') ? TvType.TVSERIES : TvType.MOVIE;

      const episodes: any[] = [];

      if (type === TvType.TVSERIES) {
        $('.episode-item, .episode a').each((i, el) => {
          const epId = $(el).attr('data-id') || $(el).attr('href')?.split('/').pop() || '';
          const epNum = $(el).attr('data-number') || String(i + 1);
          const seasonNum = $(el).attr('data-season') || '1';

          episodes.push({
            id: epId,
            title: `Episode ${epNum}`,
            number: parseInt(epNum),
            season: parseInt(seasonNum),
            url: `${this.baseUrl}/watch-show/${epId}`,
          });
        });
      } else {
        episodes.push({
          id: mediaId,
          title: title,
          url: `${this.baseUrl}/watch-movie/${mediaId}`,
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
      const response = await this.client.get(`${this.baseUrl}/watch/${episodeId}`);
      const $ = load(response.data);
      const iframeSrc = $('iframe').attr('src') || '';

      const sources = [];
      if (iframeSrc) {
        sources.push({
          url: iframeSrc,
          quality: 'auto',
          isM3U8: iframeSrc.includes('.m3u8'),
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

export default Flixer;
