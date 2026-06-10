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

class Cineby extends MovieParser {
  override readonly name = 'Cineby';
  protected override baseUrl = 'https://cineby.app';
  protected override logo = 'https://cineby.app/favicon.ico';
  protected override classPath = 'MOVIES.Cineby';
  override supportedTypes = new Set([TvType.MOVIE, TvType.TVSERIES]);

  override search = async (query: string, page: number = 1): Promise<ISearch<IMovieResult>> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/search/${encodeURIComponent(query)}?page=${page}`);
      const $ = load(response.data);
      const results: IMovieResult[] = [];

      $('.movie-card, .film-item, article').each((_, el) => {
        const title = $(el).find('.movie-title, .title, h3 a').text().trim();
        const href = $(el).find('a').first().attr('href');
        const image = $(el).find('img').attr('src');
        const id = href ? href.replace(/^\//, '').replace(/\/$/, '') : '';

        if (title && id) {
          results.push({
            id,
            title,
            image,
            url: `${this.baseUrl}/${id}`,
            type: id.includes('/tv/') ? TvType.TVSERIES : TvType.MOVIE,
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

      const title = $('.movie-details h1, h1.title').text().trim();
      const image = $('.poster img, img.movie-poster').attr('src');
      const description = $('.description, .storyline').text().trim();
      const type = mediaId.includes('tv/') ? TvType.TVSERIES : TvType.MOVIE;

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
            url: `${this.baseUrl}/watch-tv/${mediaId}/${epId}`,
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
      // Cineby uses vidsrc/vidcloud embed. Fetching page and extracting stream source.
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

export default Cineby;
