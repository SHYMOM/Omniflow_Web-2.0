import { load } from 'cheerio';
import {
  MangaParser,
  ISearch,
  IMangaInfo,
  IMangaResult,
  IMangaChapterPage,
  MediaStatus,
} from '../../models';

class Webtoons extends MangaParser {
  override readonly name = 'Webtoons';
  protected override baseUrl = 'https://www.webtoons.com';
  protected override logo = 'https://www.webtoons.com/favicon.ico';
  protected override classPath = 'MANGA.Webtoons';

  override search = async (query: string, page: number = 1): Promise<ISearch<IMangaResult>> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/search?keyword=${encodeURIComponent(query)}`);
      const $ = load(response.data);
      const results: IMangaResult[] = [];

      $('.card_wrap li, ul.card_lst li').each((_, el) => {
        const title = $(el).find('.subj, .title').text().trim();
        const href = $(el).find('a').first().attr('href');
        const image = $(el).find('img').attr('src');
        const id = href ? href.split('titleNo=').pop() || '' : '';

        if (title && id) {
          results.push({
            id,
            title,
            image,
            url: href,
          });
        }
      });

      return {
        currentPage: page,
        results,
      };
    } catch (err) {
      return { currentPage: page, results: [] };
    }
  };

  override fetchMangaInfo = async (mangaId: string): Promise<IMangaInfo> => {
    try {
      // Fetching the title info
      const response = await this.client.get(`${this.baseUrl}/episodeList?titleNo=${mangaId}`);
      const $ = load(response.data);

      const title = $('.subj, h1.subj').text().trim();
      const image = $('.thmb img').attr('src');
      const description = $('.summary, .txt_desc').text().trim();

      const chapters: any[] = [];
      $('#_listUl li a, ul.episode_list li a').each((i, el) => {
        const href = $(el).attr('href');
        const chapId = href ? href.split('episodeNo=').pop() || '' : '';
        const chapNum = $(el).find('.tx, .episode_num').text().trim() || String(i + 1);

        if (chapId) {
          chapters.push({
            id: `${mangaId}-${chapId}`,
            title: `Chapter ${chapNum}`,
            chapterNumber: chapNum,
          });
        }
      });

      return {
        id: mangaId,
        title,
        image,
        description,
        status: MediaStatus.ONGOING,
        chapters,
      };
    } catch (err) {
      return { id: mangaId, title: mangaId, chapters: [] };
    }
  };

  override fetchChapterPages = async (chapterId: string): Promise<IMangaChapterPage[]> => {
    try {
      const [titleNo, episodeNo] = chapterId.split('-');
      const response = await this.client.get(`${this.baseUrl}/viewer?titleNo=${titleNo}&episodeNo=${episodeNo}`);
      const $ = load(response.data);
      const pages: IMangaChapterPage[] = [];

      $('#_imageList img, .viewer_img img').each((i, el) => {
        const img = $(el).attr('data-url') || $(el).attr('src');
        if (img) {
          pages.push({
            img,
            page: i,
          });
        }
      });

      return pages;
    } catch (err) {
      return [];
    }
  };
}

export default Webtoons;
