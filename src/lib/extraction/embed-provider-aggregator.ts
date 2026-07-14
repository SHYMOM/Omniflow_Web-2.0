import { IStreamSource, IStreamSubtitle } from '@/types/extraction-types';

interface EmbedProvider {
  name: string;
  /** Which ID type this provider expects (default: 'tmdb') */
  idType?: 'tmdb' | 'imdb';
  getMovieUrl: (id: string) => string;
  getTvUrl: (id: string, season: number, episode: number) => string;
  // Whether this provider supports Firefox iframe embedding
  firefoxCompatible?: boolean;
}

export class EmbedProviderAggregator {
  name = 'EmbedProviderAggregator';

  // Firefox-compatible embed providers (no X-Frame-Options: SAMEORIGIN or CSP blocking)
  // Order matters - first working one wins
  private providers: EmbedProvider[] = [
    // VidSrc alternatives that work in Firefox — all use TMDB IDs
    {
      name: 'vidsrc.xyz',
      getMovieUrl: (id) => `https://vidsrc.xyz/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`,
      firefoxCompatible: true
    },
    {
      name: 'vidsrc.to',
      getMovieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
      firefoxCompatible: true
    },
    {
      name: 'vidsrc.in',
      getMovieUrl: (id) => `https://vidsrc.in/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.in/embed/tv/${id}/${s}/${e}`,
      firefoxCompatible: true
    },
    // Embed.su - known to work in Firefox
    {
      name: 'embed.su',
      getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
      firefoxCompatible: true
    },
    // Multiembed - works in Firefox
    {
      name: 'multiembed.mov',
      getMovieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
      getTvUrl: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
      firefoxCompatible: true
    },
    // 2embed - alternative
    {
      name: '2embed.cc',
      getMovieUrl: (id) => `https://2embed.cc/embed/${id}`,
      getTvUrl: (id, s, e) => `https://2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
      firefoxCompatible: true
    },
    // Vidmoly
    {
      name: 'vidmoly.to',
      getMovieUrl: (id) => `https://vidmoly.to/embed/${id}`,
      getTvUrl: (id, s, e) => `https://vidmoly.to/embed/${id}/${s}/${e}`,
      firefoxCompatible: true
    },
    // Legacy vidsrc.cc (may be blocked in Firefox)
    {
      name: 'vidsrc.cc',
      getMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`,
      firefoxCompatible: false
    },
  ];

  /**
   * Scrape movie sources from embed providers.
   * @param tmdbId - Numeric TMDB ID (preferred, used by most embed providers)
   * @param imdbId - IMDB ID with 'tt' prefix (fallback only)
   */
  async scrapeMovie(tmdbId?: string, imdbId?: string): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const id = tmdbId || imdbId || '';
    if (!id) return { sources: [], subtitles: [] };
    const urls = this.providers.map(p => {
      const pid = (p.idType === 'imdb' && imdbId) ? imdbId : (tmdbId || id);
      return { name: p.name, url: p.getMovieUrl(pid), idType: p.idType };
    });
    return this.scrapeUrls(urls);
  }

  /**
   * Scrape TV series sources from embed providers.
   */
  async scrapeSeries(tmdbId?: string, season: number = 1, episode: number = 1, imdbId?: string): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const id = tmdbId || imdbId || '';
    if (!id) return { sources: [], subtitles: [] };
    const urls = this.providers.map(p => {
      const pid = (p.idType === 'imdb' && imdbId) ? imdbId : (tmdbId || id);
      return { name: p.name, url: p.getTvUrl(pid, season, episode), idType: p.idType };
    });
    return this.scrapeUrls(urls);
  }

  private async scrapeUrls(targets: { name: string; url: string }[]): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    let browser: any = null;
    const sources: IStreamSource[] = [];
    const subtitles: IStreamSubtitle[] = [];
    
    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        bypassCSP: true
      });

      // We run all target scrapes concurrently
      const scrapePromises = targets.map(async (target) => {
        const page = await context.newPage();
        
        // Listen for responses
        page.on('response', (response: any) => {
          try {
            const reqUrl = response.url();
            if ((reqUrl.includes('.m3u8') || reqUrl.includes('.mp4')) &&
                !reqUrl.includes('blank.m3u8')) {
              
              const isM3U8 = reqUrl.includes('.m3u8');
              sources.push({
                url: reqUrl,
                quality: 'auto',
                isM3U8,
                referer: target.url,
                provider: { id: target.name, name: target.name }
              });
            }
          } catch (e) {
            // Ignore frame or response errors
          }
        });

        try {
          await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          // Micro delay to let network requests fire
          await page.waitForTimeout(2000);
          
          // Trigger a click to start load/play
          await page.mouse.click(400, 300).catch(() => {});
          
          // Wait another moment for the play click to trigger network requests
          await page.waitForTimeout(3000);
        } catch (err) {
          // Page fail is fine, other pages might succeed
        } finally {
          await page.close().catch(() => {});
        }
      });

      // Run all pages in parallel with a timeout
      await Promise.race([
        Promise.all(scrapePromises),
        new Promise(resolve => setTimeout(resolve, 18000))
      ]);

    } catch (e) {
      console.error('[EmbedProviderAggregator] scraping error:', e);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    return { sources, subtitles };
  }
}
