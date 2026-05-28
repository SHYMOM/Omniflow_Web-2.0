import * as cheerio from "cheerio";
import { IStreamResult, IStreamSource } from '@/types/extraction-types';
import { StealthHttpClient } from './stealth-client';
import { findBestMatch } from './string-matching';

const BASE_URL = "https://animehindidubbed.in";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DEFAULT_CORS_HEADERS = {
  Referer: BASE_URL,
  Origin: BASE_URL,
  "User-Agent": UA,
};

export class HindiDubbedExtractor {
  private stealthClient = new StealthHttpClient();

  private async fetchPage(url: string, referer?: string) {
     return this.stealthClient.get(url, {
       headers: { "User-Agent": UA, Referer: referer || BASE_URL, Accept: "text/html,*/*;q=0.8" },
       timeout: 10000
     });
  }

  async extractDirectStream(title: string, episode: number = 1): Promise<IStreamResult> {
    try {
      // 1. Search
      const searchRes = await this.fetchPage(`${BASE_URL}/?s=${encodeURIComponent(title)}`);
      const $ = cheerio.load(searchRes.data);
      
      let candidates: {title: string, slug: string}[] = [];
      $("article, .post, .type-post").each((_, el) => {
        const titleEl = $(el).find(".entry-title a, .post-title a, h2 a").first();
        const t = titleEl.text().trim();
        const link = titleEl.attr("href");
        
        const slugMatch = link?.match(/animehindidubbed\.in\/([^/]+)\/?/);
        if (slugMatch) {
          candidates.push({ title: t, slug: slugMatch[1] });
        }
      });

      const bestMatch = findBestMatch(title, candidates);
      const matchedSlug = bestMatch?.slug;

      if (!matchedSlug) {
        throw new Error(`No search results found for ${title}`);
      }

      // 2. Fetch anime detail page
      const animeRes = await this.fetchPage(`${BASE_URL}/${matchedSlug}/`);
      const $anime = cheerio.load(animeRes.data);
      
      const servers: Record<string, Array<{ name: string; url: string }>> = { filemoon: [], servabyss: [], vidgroud: [] };
      $anime("script").each((_, s) => {
        const sc = $anime(s).html() || "";
        if (!sc.includes("serverVideos")) return;
        
        // Extract server sub-blocks (e.g. filemoon: [...], servabyss: [...], vidgroud: [...])
        const extractBlock = (serverName: string): string => {
          const regex = new RegExp(`${serverName}\\s*:\\s*\\[([\\s\\S]*?)\\]`);
          return sc.match(regex)?.[1] || "";
        };

        const parseServerList = (block: string) => {
          const list: Array<{ name: string; url: string }> = [];
          const entries = block.match(/{[\s\S]*?}/g) || [];
          for (const entry of entries) {
            const nameM = entry.match(/name\s*:\s*["']([^"']+)["']/);
            const urlM = entry.match(/url\s*:\s*["']([^"']+)["']/);
            if (nameM && urlM) {
              list.push({ name: nameM[1], url: urlM[2] });
            }
          }
          return list;
        };

        const filemoonBlock = extractBlock("filemoon");
        const servabyssBlock = extractBlock("servabyss");
        const vidgroudBlock = extractBlock("vidgroud");

        if (filemoonBlock) servers.filemoon = parseServerList(filemoonBlock);
        if (servabyssBlock) servers.servabyss = parseServerList(servabyssBlock);
        if (vidgroudBlock) servers.vidgroud = parseServerList(vidgroudBlock);
      });

      // 3. Find episode servers
      let targetServers: Array<{name: string, url: string}> = [];
      const checkServers = (list: any[], serverName: string) => {
        list.forEach(item => {
          const se = item.name.match(/S(\d+)E(\d+)/i);
          const num = se ? parseInt(se[2]) : parseInt(item.name.match(/(\d+)/)?.[1] || "0");
          if (num === episode) {
             targetServers.push({ name: serverName, url: item.url });
          }
        });
      };
      
      checkServers(servers.vidgroud, "Vidgroud"); 
      checkServers(servers.filemoon, "Filemoon");
      // Intentionally skipping Servabyss per TatakaiAPI recommendations

      if (targetServers.length === 0) {
         throw new Error(`Episode ${episode} not found`);
      }

      // 4. Extract M3U8
      for (const server of targetServers) {
         try {
            const hlsUrls = await this.extractEpisodeHls(server.url);
            if (hlsUrls.length > 0) {
               const sources: IStreamSource[] = hlsUrls.map(u => ({
                  url: u,
                  quality: 'auto',
                  isM3U8: true
               }));
               return {
                  success: true,
                  provider: 'hindidubbed',
                  sources,
                  subtitles: [],
                  headers: DEFAULT_CORS_HEADERS
               };
            }
         } catch (e) { }
      }

      throw new Error(`Exhausted servers for episode ${episode}`);
    } catch (e: any) {
      console.warn(`[HindiDubbedExtractor] Failed:`, e.message);
      return {
        success: false,
        provider: 'hindidubbed',
        sources: [],
        subtitles: [],
        headers: {}
      };
    }
  }

  private async extractEpisodeHls(sourceUrl: string): Promise<string[]> {
      const hls = new Set<string>();
      try {
          const res = await this.fetchPage(sourceUrl, BASE_URL);
          const html = res.data;
          
          const extractM3u8FromText = (text: string) => {
              const matches = text.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi) || [];
              const normalized = matches.map((m) => m.replace(/\\\//g, "/"));
              return Array.from(new Set(normalized));
          };

          extractM3u8FromText(html).forEach((u) => hls.add(u));

          const $ = cheerio.load(html);
          const scriptBlob = $("script").map((_, s) => $(s).html() || "").get().join("\n");
          extractM3u8FromText(scriptBlob).forEach((u) => hls.add(u));

          const candidates = new Set<string>();
          $("iframe[src], script[src], source[src], video source[src], a[href]").each((_, el) => {
              const raw = $(el).attr("src") || $(el).attr("href");
              if (!raw) return;
              if (!/^https?:\/\//i.test(raw)) return;
              if (/\.(js|css|png|jpg|jpeg|svg|woff2?)(\?|$)/i.test(raw)) return;
              candidates.add(raw);
          });

          for (const candidate of Array.from(candidates).slice(0, 12)) {
              if (/servabyss/i.test(candidate)) continue;
              try {
                  const content = await this.fetchPage(candidate, sourceUrl);
                  extractM3u8FromText(content.data).forEach((u) => hls.add(u));
              } catch { }
          }
      } catch (e) { }
      return Array.from(hls);
  }
}
