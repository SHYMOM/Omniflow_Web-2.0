import * as cheerio from "cheerio";
import { IStreamResult, IStreamSource } from '@/types/extraction-types';
import { StealthHttpClient } from './stealth-client';
import { findBestMatch } from './string-matching';

const BASE_URL = "https://www.desidubanime.me";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_HEADERS = { "User-Agent": UA, Referer: BASE_URL };

export class DesiDubAnimeExtractor {
  private stealthClient = new StealthHttpClient();

  private async fetchHtml(path: string): Promise<string> {
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    const res = await this.stealthClient.get(url, { headers: DEFAULT_HEADERS, timeout: 12000 });
    return res.data;
  }

  async extractDirectStream(title: string, episode: number = 1): Promise<IStreamResult> {
    try {
      // 1. Search
      const html = await this.fetchHtml(`/?s=${encodeURIComponent(title)}`);
      const $ = cheerio.load(html);
      const results: any[] = [];

      $("article.post, article, .search-page article, a[href*='/anime/']").each((_, el) => {
        const a = $(el).is("a") ? $(el) : $(el).find("a.lnk-blk, .entry-title a, h2 a, h3 a, a[href*='/anime/']").first();
        const t = (a.attr("title") || a.text() || $(el).find(".entry-title").text()).trim();
        const url = a.attr("href");
        let slug = "";
        if (url) {
          const m = url.match(/\/(?:anime|series)\/([^/]+)\/?$/);
          if (m) slug = m[1];
        }
        if (t && slug) results.push({ title: t, slug });
      });

      const bestMatch = findBestMatch(title, results);
      if (!bestMatch) {
        throw new Error(`DesiDubAnime: No match found for ${title}`);
      }

      // 2. Get Info & Episodes
      const infoHtml = await this.fetchHtml(`/anime/${bestMatch.slug}/`);
      const $info = cheerio.load(infoHtml);
      const episodes: any[] = [];

      $info(".swiper-episode-anime .swiper-slide a, .episode-list-display-box a, a[href*='/watch/']").each((_, el) => {
        const epUrl = $info(el).attr("href");
        const epNumStr = $info(el).find(".episode-list-item-number").text().trim() || $info(el).text().match(/episode\s*(\d+)/i)?.[1] || epUrl?.match(/episode-(\d+)/i)?.[1];
        const m = epUrl?.match(/\/watch\/([^/]+)\/?/);
        if (m && epNumStr) {
          episodes.push({ id: m[1], number: parseFloat(epNumStr), url: epUrl });
        }
      });

      if (episodes.length === 0) {
        $info("a[href*='/watch/']").each((_, el) => {
          const epUrl = $info(el).attr("href");
          const m = epUrl?.match(/\/watch\/([^/]+)\/?/);
          if (m) {
            episodes.push({ id: m[1], number: 1, url: epUrl });
          }
        });
      }

      const targetEp = episodes.find(e => e.number === episode);
      if (!targetEp) {
        throw new Error(`DesiDubAnime: Episode ${episode} not found`);
      }

      // 3. Extract Streams from Watch Page
      const watchHtml = await this.fetchHtml(`/watch/${targetEp.id}/`);
      const $watch = cheerio.load(watchHtml);
      const sources: IStreamSource[] = [];
      const decodeB64 = (str: string) => { try { return atob(str); } catch { return ""; } };

      $watch("span[data-embed-id]").each((_, el) => {
        const embedData = $watch(el).attr("data-embed-id");
        if (!embedData) return;
        const [b64Name, b64Url] = embedData.split(":");
        if (!b64Name || !b64Url) return;
        
        let finalUrl = decodeB64(b64Url);
        if (finalUrl.includes("<iframe")) {
          const m = finalUrl.match(/src=['"]([^'"]+)['"]/);
          if (m) finalUrl = m[1];
        }
        
        if (finalUrl && !finalUrl.includes("googletagmanager")) {
          sources.push({
            url: finalUrl,
            quality: 'auto',
            isM3U8: finalUrl.includes(".m3u8")
          });
        }
      });

      if (sources.length === 0) {
        // Fallback to iframes
        $watch("iframe").each((_, el) => {
          const src = $watch(el).attr("src") || $watch(el).attr("data-src");
          if (src && !src.includes("googletagmanager") && !src.includes("cdn-cgi")) {
            sources.push({ url: src, quality: 'auto', isM3U8: src.includes(".m3u8") });
          }
        });
      }

      if (sources.length === 0) {
         throw new Error('DesiDubAnime: No stream sources found');
      }

      // To convert embeds into direct streams, we ideally need to intercept them or they might just work if isM3U8
      // But for now, returning the embed URLs so standard UI can handle or Playwright can intercept
      return {
        success: true,
        provider: 'desidubanime',
        sources,
        subtitles: [],
        headers: DEFAULT_HEADERS
      };

    } catch (e: any) {
      console.warn(`[DesiDubAnimeExtractor] Failed:`, e.message);
      return {
        success: false,
        provider: 'desidubanime',
        sources: [],
        subtitles: [],
        headers: {}
      };
    }
  }
}
