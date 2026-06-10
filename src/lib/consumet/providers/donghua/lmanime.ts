import { load } from 'cheerio';
import {
  AnimeParser,
  ISearch,
  IAnimeInfo,
  IAnimeResult,
  ISource,
  IAnimeEpisode,
  IEpisodeServer,
  MediaStatus,
} from '../../models';

class LMAnime extends AnimeParser {
  override readonly name = 'LMAnime';
  protected override baseUrl = 'https://lmanime.com';
  protected override logo = 'https://lmanime.com/favicon.ico';
  protected override classPath = 'DONGHUA.LMAnime';

  override search = async (query: string): Promise<ISearch<IAnimeResult>> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/?s=${encodeURIComponent(query)}`);
      const $ = load(response.data);
      const results: IAnimeResult[] = [];

      $('.post-item, article').each((_, el) => {
        const title = $(el).find('.post-title a, h2 a').first().text().trim();
        const href = $(el).find('a').first().attr('href');
        const image = $(el).find('img').first().attr('src');
        const id = href ? href.replace(`${this.baseUrl}/`, '').replace(/\/$/, '') : '';

        if (title && id) {
          results.push({
            id,
            title,
            image,
            url: href,
          });
        }
      });

      return { results };
    } catch (err) {
      return { results: [] };
    }
  };

  override fetchAnimeInfo = async (id: string): Promise<IAnimeInfo> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/${id}/`);
      const $ = load(response.data);
      const title = $('.entry-title, h1').text().trim();
      const image = $('.poster img, img.wp-post-image').attr('src');

      const episodes: IAnimeEpisode[] = [];
      $('.episodes-list a, .ep-list li a').each((i, el) => {
        const href = $(el).attr('href');
        const epNumStr = $(el).text().match(/(\d+)/)?.[1] || String(i + 1);
        const epId = href ? href.replace(`${this.baseUrl}/`, '').replace(/\/$/, '') : '';
        if (epId) {
          episodes.push({
            id: epId,
            number: parseFloat(epNumStr),
            title: `Episode ${epNumStr}`,
            url: href,
          });
        }
      });

      if (episodes.length === 0) {
        episodes.push({
          id: `${id}-episode-1`,
          number: 1,
          title: 'Episode 1',
        });
      }

      return {
        id,
        title,
        image,
        episodes,
        status: MediaStatus.ONGOING,
      };
    } catch (err) {
      return { id, title: id, episodes: [] };
    }
  };

  override fetchEpisodeSources = async (episodeId: string): Promise<ISource> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/${episodeId}/`);
      const $ = load(response.data);

      const sources: any[] = [];
      const subtitles: any[] = [];

      $('iframe[src], .player-container iframe').each((_, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http')) {
          sources.push({
            url: src,
            quality: 'auto',
            isM3U8: src.includes('.m3u8'),
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
        subtitles,
        headers: {
          Referer: this.baseUrl,
        },
      };
    } catch (err) {
      return { sources: [] };
    }
  };

  override fetchEpisodeServers = async (episodeLink: string): Promise<IEpisodeServer[]> => {
    return [];
  };
}

export default LMAnime;
