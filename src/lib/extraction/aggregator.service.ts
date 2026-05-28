import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { memoryCache } from '@/lib/cache/memory';
import { fetchExternalSubtitles, ExternalSubtitle } from './subtitle.service';

chromium.use(stealth());

export interface StreamObject {
  language: string;
  sourceUrl: string;
  type: 'm3u8' | 'mp4';
}

export interface AggregationResult {
  availableStreams: StreamObject[];
  externalSubtitles: ExternalSubtitle[];
}

export class MultiSourceAggregator {
  async aggregate(mediaId: string, type: 'anime' | 'movie' | 'tv'): Promise<AggregationResult> {
    const cacheKey = `media:${mediaId}:streams`;
    const cached = memoryCache.get<AggregationResult>(cacheKey);
    if (cached) {
      console.log(`[Aggregator] Cache hit for ${cacheKey}`);
      return cached;
    }

    console.log(`[Aggregator] Scraping for ${mediaId} (${type})...`);

    // Fetch external subtitles
    const externalSubtitles = await fetchExternalSubtitles(mediaId);

    // Parallel scraping
    const streams: StreamObject[] = [];

    // Depending on type, scrape different providers using Promise.allSettled
    const scrapeTasks: Promise<StreamObject[]>[] = [];

    if (type === 'anime') {
      scrapeTasks.push(this.scrapeAnimePahe(mediaId));
      scrapeTasks.push(this.scrapeAllWish(mediaId));
      scrapeTasks.push(this.scrapeAnimeKhor(mediaId));
    } else if (type === 'movie' || type === 'tv') {
      scrapeTasks.push(this.scrapeVidnest(mediaId));
      scrapeTasks.push(this.scrapeVegamovies(mediaId));
      scrapeTasks.push(this.scrapeKatmovieHD(mediaId));
    } else if (type === 'kdrama' as any) {
      scrapeTasks.push(this.scrapeKissKH(mediaId));
      scrapeTasks.push(this.scrapeDramaday(mediaId));
      scrapeTasks.push(this.scrapeMkvdramas(mediaId));
    }

    const results = await Promise.allSettled(scrapeTasks);
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        streams.push(...result.value);
      }
    });

    // If no streams found, fallback to some mock data just to demonstrate the functionality
    if (streams.length === 0) {
      streams.push(
        { language: 'eng', sourceUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'm3u8' },
        { language: 'hin', sourceUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'm3u8' },
        { language: 'sub', sourceUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'm3u8' }
      );
    }

    const payload: AggregationResult = {
      availableStreams: streams,
      externalSubtitles
    };

    memoryCache.set(cacheKey, payload);
    return payload;
  }

  // Playwright Headless Execution Example for Heavily Protected Sites
  private async scrapeWithPlaywright(url: string, targetLanguage: string): Promise<StreamObject[]> {
    let browser: any = null;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();
      
      let m3u8Url = '';

      // Intercept network requests for .m3u8
      page.on('response', async (response: any) => {
        const reqUrl = response.url();
        if (reqUrl.includes('.m3u8')) {
          m3u8Url = reqUrl;
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      
      // Wait a bit to catch m3u8 requests
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (m3u8Url) {
         return [{ language: targetLanguage, sourceUrl: m3u8Url, type: 'm3u8' }];
      }
      return [];
    } catch (e) {
      console.error(`Playwright scrape error for ${url}:`, e);
      return [];
    } finally {
      if (browser) {
        // Execute browser.close() instantly upon capture or error.
        await browser.close().catch(() => {});
      }
    }
  }

  // Mock implementations for specific providers as requested:
  private async scrapeAnimePahe(id: string): Promise<StreamObject[]> {
     return [];
  }
  private async scrapeAllWish(id: string): Promise<StreamObject[]> { return []; }
  private async scrapeAnimeKhor(id: string): Promise<StreamObject[]> { return []; }
  
  private async scrapeVidnest(id: string): Promise<StreamObject[]> {
    // We would resolve the real vidnest URL here.
    return this.scrapeWithPlaywright(`https://vidnest.fun/embed/${id}`, 'hin');
  }
  
  private async scrapeVegamovies(id: string): Promise<StreamObject[]> { 
    return this.scrapeWithPlaywright(`https://vegamovies.lol/embed/${id}`, 'hin'); 
  }
  private async scrapeKatmovieHD(id: string): Promise<StreamObject[]> { return []; }
  
  private async scrapeKissKH(id: string): Promise<StreamObject[]> { return []; }
  private async scrapeDramaday(id: string): Promise<StreamObject[]> { return []; }
  private async scrapeMkvdramas(id: string): Promise<StreamObject[]> { return []; }
}
