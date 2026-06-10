import { load } from 'cheerio';
import {
  MangaParser,
  ISearch,
  IMangaInfo,
  IMangaResult,
  IMangaChapterPage,
  MediaStatus,
} from '../../models';

class MangaFire extends MangaParser {
  override readonly name = 'MangaFire';
  protected override baseUrl = 'https://mangafire.to';
  protected override logo = 'https://mangafire.to/assets/images/logo.png';
  protected override classPath = 'MANGA.MangaFire';

  override search = async (query: string, page: number = 1): Promise<ISearch<IMangaResult>> => {
    try {
      const response = await this.client.get(`${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`);
      const $ = load(response.data);
      const results: IMangaResult[] = [];

      $('.original .row > div, .manga-list .item').each((_, el) => {
        const title = $(el).find('.film-name a, h3 a').text().trim();
        const href = $(el).find('a').first().attr('href');
        const image = $(el).find('img').attr('src');
        const id = href ? href.replace(/^\//, '').replace(/\/$/, '') : '';

        if (title && id) {
          results.push({
            id,
            title,
            image,
            url: `${this.baseUrl}/${id}`,
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
      const response = await this.client.get(`${this.baseUrl}/${mangaId}`);
      const $ = load(response.data);

      const title = $('.manga-name, h1').text().trim();
      const image = $('.poster img').attr('src');
      const description = $('.description, .synopsis').text().trim();

      const chapters: any[] = [];
      $('.chapters a, ul.episodes a').each((i, el) => {
        const href = $(el).attr('href');
        const chapId = href ? href.replace(/^\//, '').replace(/\/$/, '') : '';
        const chapNum = $(el).attr('data-number') || String(i + 1);

        if (chapId) {
          chapters.push({
            id: chapId,
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
      const response = await this.client.get(`${this.baseUrl}/${chapterId}`);
      const $ = load(response.data);
      const pages: IMangaChapterPage[] = [];

      $('.images-list img, .page-img').each((i, el) => {
        const img = $(el).attr('src') || $(el).attr('data-src');
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

export default MangaFire;
