import { IStreamSource, IStreamSubtitle } from '@/types/extraction-types';

interface EmbedProvider {
  name: string;
  getMovieUrl: (imdbId: string) => string;
  getTvUrl: (imdbId: string, season: number, episode: number) => string;
}

export class EmbedProviderAggregator {
  name = 'EmbedProviderAggregator';

  private providers: EmbedProvider[] = [
    {
      name: 'vidsrc.cc',
      getMovieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
    },
    {
      name: 'vidsrc.to',
      getMovieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
    },
    {
      name: 'vidsrc.me',
      getMovieUrl: (id) => `https://vidsrc.me/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://vidsrc.me/embed/tv/${id}/${s}/${e}`
    },
    {
      name: 'embed.su',
      getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
      getTvUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
    },
    {
      name: 'multiembed.mov',
      getMovieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
      getTvUrl: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`
    },
    {
      name: '2embed.cc',
      getMovieUrl: (id) => `https://2embed.cc/embed/${id}`,
      getTvUrl: (id, s, e) => `https://2embed.cc/embedtv/${id}&s=${s}&e=${e}`
    },
    {
      name: 'vidmoly.to',
      getMovieUrl: (id) => `https://vidmoly.to/embed/${id}`,
      getTvUrl: (id, s, e) => `https://vidmoly.to/embed/${id}/${s}/${e}`
    }
  ];

  async scrapeMovie(imdbId: string): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const urls = this.providers.map(p => ({ name: p.name, url: p.getMovieUrl(imdbId) }));
    return this.scrapeUrls(urls);
  }

  async scrapeSeries(imdbId: string, season: number, episode: number): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const urls = this.providers.map(p => ({ name: p.name, url: p.getTvUrl(imdbId, season, episode) }));
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
