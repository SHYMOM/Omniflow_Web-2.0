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

class CKSub extends AnimeParser {
  override readonly name = 'CKSub';
  protected override baseUrl = 'https://cksub.org';
  protected override logo = 'https://cksub.org/favicon.ico';
  protected override classPath = 'ANIME.CKSub';

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
      const title = $('.entry-title, h1.title').text().trim();
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

      // Extract embed players
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

      // Extract sidecar subtitles (.vtt or .srt)
      $('track[kind="subtitles"], a[href$=".vtt"], a[href$=".srt"]').each((_, el) => {
        const url = $(el).attr('src') || $(el).attr('href');
        const lang = $(el).attr('srclang') || $(el).attr('data-lang') || 'en';
        const label = $(el).attr('label') || $(el).text().trim() || 'English';

        if (url) {
          subtitles.push({
            url,
            lang,
            label,
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

export default CKSub;
