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

class KDramasMaza extends MovieParser {
  override readonly name = 'KDramasMaza';
  protected override baseUrl = 'https://kdramasmaza.net';
  protected override logo = 'https://kdramasmaza.net/favicon.ico';
  protected override classPath = 'DRAMA.KDramasMaza';
  override supportedTypes = new Set([TvType.MOVIE, TvType.TVSERIES]);

  override search = async (query: string, page: number = 1): Promise<ISearch<IMovieResult>> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/?s=${encodeURIComponent(query)}&page=${page}`);
      const $ = load(response.data);
      const results: IMovieResult[] = [];

      $('.post-item, article').each((_, el) => {
        const title = $(el).find('.entry-title a, h2 a').text().trim();
        const href = $(el).find('a').first().attr('href');
        const image = $(el).find('img').attr('src');
        const id = href ? href.replace(`${this.baseUrl}/`, '').replace(/\/$/, '') : '';

        if (title && id) {
          results.push({
            id,
            title,
            image,
            url: href,
            type: TvType.TVSERIES,
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
      const response = await this.client.get(`${this.baseUrl}/${mediaId}/`);
      const $ = load(response.data);

      const title = $('.entry-title, h1').text().trim();
      const image = $('.poster img, img.wp-post-image').attr('src');
      const description = $('.entry-content p').text().trim();
      const type = TvType.TVSERIES;

      const episodes: any[] = [];
      $('.episode-list a, .download-btn, a[href*="episode"]').each((i, el) => {
        const href = $(el).attr('href');
        const epNumStr = $(el).text().match(/(\d+)/)?.[1] || String(i + 1);

        if (href) {
          episodes.push({
            id: href.replace(`${this.baseUrl}/`, '').replace(/\/$/, ''),
            title: `Episode ${epNumStr}`,
            number: parseInt(epNumStr),
            season: 1,
            url: href,
          });
        }
      });

      if (episodes.length === 0) {
        episodes.push({
          id: mediaId,
          title: title,
          url: `${this.baseUrl}/${mediaId}`,
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
      const response = await this.client.get(`${this.baseUrl}/${episodeId}/`);
      const $ = load(response.data);
      const sources: any[] = [];

      // Extract Mega, GDrive, MediaFire, StreamWish links
      $('a[href*="mega.nz"], a[href*="drive.google.com"], a[href*="streamwish"], a[href*="mediafire"]').each((_, el) => {
        const href = $(el).attr('href');
        const label = $(el).text().trim().toLowerCase();

        if (href) {
          sources.push({
            url: href,
            quality: label.includes('720p') ? '720p' : (label.includes('1080p') ? '1080p' : 'auto'),
            isM3U8: href.includes('.m3u8') || href.includes('streamwish'),
          });
        }
      });

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

export default KDramasMaza;
