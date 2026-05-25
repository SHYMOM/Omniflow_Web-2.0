import { IStreamResult } from '@/types/extraction-types';
import { PLAYWRIGHT_TIMEOUT_MS } from './extraction-config';

export class PlaywrightExtractor {
  async extractDirectStream(
    mediaId: string, // Changed from tmdbId to mediaId to support anilist mapping
    mediaType: 'movie' | 'tv' | 'anime',
    episode: number = 1,
    season: number = 1,
    isDub: boolean = false
  ): Promise<IStreamResult> {
    const { chromium } = await import('playwright');
    
    // We try multiple popular embed servers including Vidnest as a high-speed fallback
    const embedUrls: string[] = [];
    
    if (mediaType === 'movie') {
      embedUrls.push(
        `https://vidnest.fun/movie/${mediaId}`,
        `https://vidlink.pro/movie/${mediaId}`,
        `https://vidsrc.me/embed/movie?tmdb=${mediaId}`,
        `https://vidsrc.net/embed/movie?tmdb=${mediaId}`
      );
    } else if (mediaType === 'tv') {
      embedUrls.push(
        `https://vidnest.fun/tv/${mediaId}/${season}/${episode}`,
        `https://vidlink.pro/tv/${mediaId}/${season}/${episode}`,
        `https://vidsrc.me/embed/tv?tmdb=${mediaId}&season=${season}&ep=${episode}`,
        `https://vidsrc.net/embed/tv?tmdb=${mediaId}&season=${season}&ep=${episode}`
      );
    } else if (mediaType === 'anime') {
      const subOrDub = isDub ? 'dub' : 'sub';
      embedUrls.push(
        `https://vidnest.fun/anime/${mediaId}/${episode}/${subOrDub}`,
        `https://vidnest.fun/animepahe/${mediaId}/${episode}/${subOrDub}`
      );
    }

    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      // Map each embed URL to a promise that launches a page and waits for m3u8
      const promises = embedUrls.map(async (embedUrl) => {
        const page = await context.newPage();
        
        return new Promise<IStreamResult>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            page.close().catch(() => {});
            reject(new Error(`Timeout for ${embedUrl}`));
          }, PLAYWRIGHT_TIMEOUT_MS || 8000);
          
          page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') && !url.includes('master.m3u8') && !url.includes('blank.m3u8')) {
              clearTimeout(timeoutId);
              const result: IStreamResult = {
                success: true,
                provider: 'playwright-interceptor',
                sources: [{ url, quality: 'auto', isM3U8: true }],
                subtitles: [],
                headers: { Referer: request.headers().referer || embedUrl }
              };
              page.close().catch(() => {});
              resolve(result);
            }
          });

          page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
            .then(async () => {
              // Try to click center to trigger the stream (works for Vidnest and Vidsrc)
              try {
                await page.waitForTimeout(1000); // Wait for embed to settle
                await page.mouse.click(500, 500); // Click center
                // Also try specific play buttons
                await page.evaluate(() => {
                  const btn = document.querySelector('.play-btn, button[aria-label="Play"], .vjs-big-play-button') as HTMLElement;
                  if (btn) btn.click();
                });
              } catch (e) {}
            })
            .catch(() => {});
        });
      });

      // Race all embeds concurrently
      const winner = await Promise.any(promises);
      await browser.close();
      return winner;

    } catch (err) {
      console.warn(`[PlaywrightExtractor] All embeds failed or timed out:`, err);
    } finally {
      if (browser) await browser.close();
    }

    return {
      success: false,
      provider: 'playwright-interceptor',
      sources: [],
      subtitles: [],
      headers: {}
    };
  }
}
