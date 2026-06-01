import * as cheerio from 'cheerio';
import { supabase } from '@/lib/supabase';
import { expandQuery } from './query-expander';
import { StealthHttpClient } from './stealth-client';
import { logger } from '../logger';

const stealthClient = new StealthHttpClient();

export interface UniversalStream {
  language: 'eng-dub' | 'hin-dub' | 'sub';
  video_url: string;
  video_type: 'm3u8' | 'mp4';
  source_name: string;
  referer?: string;
}

export interface UniversalSubtitle {
  label: string;
  url: string;
  lang: string;
  default?: boolean;
}

export interface UniversalAggregationResult {
  success: boolean;
  streams: UniversalStream[];
  subtitles: UniversalSubtitle[];
}

export class UniversalAggregatorService {
  /**
   * Main orchestrator to fetch aggregated streams.
   * Checks Supabase cache first, and cascades to scraping on a cache miss.
   */
  async aggregate(
    mediaId: string,
    mediaType: 'anime' | 'movie' | 'tv' | 'kdrama',
    season = 1,
    episode = 1,
    language?: string
  ): Promise<UniversalAggregationResult> {
    const startTime = Date.now();
    console.log(`[UniversalAggregator] Resolving streams for ${mediaId} (Season ${season}, Episode ${episode})`);

    // 1. Check Cache First
    try {
      const { data: cachedStreams, error: streamErr } = await supabase
        .from('cached_streams')
        .select('*')
        .eq('media_id', mediaId)
        .eq('season', season)
        .eq('episode', episode)
        .gt('created_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()); // 3 hours TTL

      if (!streamErr && cachedStreams && cachedStreams.length > 0) {
        console.log(`[UniversalAggregator] Cache HIT for ${mediaId} S${season}E${episode}`);
        
        // Fetch subtitles as well
        const { data: cachedSubRow } = await supabase
          .from('cached_subtitles')
          .select('subtitles')
          .eq('media_id', mediaId)
          .eq('season', season)
          .eq('episode', episode)
          .maybeSingle();

        const subtitles: UniversalSubtitle[] = cachedSubRow?.subtitles || [];

        const validStreams = cachedStreams.filter(row => !row.video_url.includes('localhost'));
        
        if (validStreams.length > 0) {
          return {
            success: true,
            streams: validStreams.map(row => ({
              language: row.language as any,
              video_url: row.video_url,
              video_type: row.video_type as any,
              source_name: row.source_name
            })),
            subtitles
          };
        }
      }
    } catch (cacheErr) {
      console.warn('[UniversalAggregator] Supabase cache read error:', cacheErr);
    }

    console.log(`[UniversalAggregator] Cache MISS. Initiating query expansion and parallel scraping...`);

    // 2. Query Expansion Matrix
    const { queries, primaryTitle, tmdbId } = await expandQuery(mediaId, mediaType, season);
    console.log(`[UniversalAggregator] Expanded "${primaryTitle}" to ${queries.length} search variations.`);

    // 3. Parallel Provider Blast
    const foundStreams: UniversalStream[] = [];
    const foundSubtitles: UniversalSubtitle[] = [];

    const scrapeTasks: Promise<any>[] = [];
    const topQueries = queries.slice(0, 2);

    // CORE SCRAPERS (Highly reliable, fast, API-based)
    if (mediaType === 'anime') {
      const { AnimeExtractionService } = await import('./anime-extraction.service');
      const animeService = new AnimeExtractionService();
      
      scrapeTasks.push(
        animeService.extractSources({
          mediaId,
          title: primaryTitle,
          episode,
          mediaType: 'anime',
          language: language || 'sub'
        }).then(coreAnime => {
          if (coreAnime.success && coreAnime.sources) {
            coreAnime.sources.forEach((src: any) => {
              const lang = src.language || this.classifyLanguage(`${primaryTitle} ${src.quality}`);
              let referer = src.referer || src.headers?.Referer || '';
              if (!referer && coreAnime.provider?.includes('pahe')) referer = 'https://animepahe.com/';
              
              foundStreams.push({
                language: lang,
                video_url: src.url,
                video_type: src.isM3U8 ? 'm3u8' : 'mp4',
                source_name: coreAnime.provider || 'core-anime',
                referer
              });
            });
            if (coreAnime.subtitles) {
              coreAnime.subtitles.forEach((sub: any) => {
                foundSubtitles.push({ label: sub.label, url: sub.url, lang: sub.lang });
              });
            }
          }
        }).catch(e => console.error('[Core Anime] error:', e))
      );
    } else {
      const { CineproAggregator } = await import('./cinepro-aggregator');
      const cinepro = new CineproAggregator();
      
      if (tmdbId) {
        scrapeTasks.push(
          (mediaType === 'movie' 
            ? cinepro.scrapeMovie(tmdbId) 
            : cinepro.scrapeSeries(tmdbId, season, episode)
          ).then(coreMovie => {
            if (coreMovie.sources && coreMovie.sources.length > 0) {
              coreMovie.sources.forEach(src => {
                const lang = this.classifyLanguage(`${primaryTitle} ${src.url}`);
                foundStreams.push({
                  language: lang,
                  video_url: src.url,
                  video_type: src.isM3U8 ? 'm3u8' : 'mp4',
                  source_name: src.provider?.id ? `cinepro-${src.provider.id}` : 'cinepro-core',
                  referer: src.referer || ''
                });
              });
              if (coreMovie.subtitles) {
                coreMovie.subtitles.forEach(sub => {
                  foundSubtitles.push({ label: sub.label, url: sub.url, lang: sub.lang });
                });
              }
            }
          }).catch(e => console.error('[Core Movie] error:', e))
        );
      }
    }

    // PLAYWRIGHT SCRAPERS (Secondary, slower, runs concurrently)
    const pwTasks: Promise<UniversalStream[]>[] = [];
    const pwSubTasks: Promise<{streams: UniversalStream[], subtitles: UniversalSubtitle[]}>[] = [];

    if (mediaType === 'anime') {
      topQueries.forEach(query => {
        pwTasks.push(this.scrapeAnimePahe(query, episode), this.scrapeAllWish(query, episode), this.scrapeAnimeKhor(query, episode));
      });
    } else if (mediaType === 'movie' || mediaType === 'tv') {
      topQueries.forEach(query => {
        pwTasks.push(this.scrapeVegamovies(query, season, episode), this.scrapeKatmovieHD(query, season, episode));
      });
    } else if (mediaType === 'kdrama') {
      topQueries.forEach(query => {
        pwSubTasks.push(this.scrapeKissKH(query, episode));
        pwTasks.push(this.scrapeDramaday(query, season, episode));
      });
    }

    scrapeTasks.push(
      Promise.allSettled(pwTasks).then(results => {
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value) {
            foundStreams.push(...res.value);
          }
        });
      }),
      Promise.allSettled(pwSubTasks).then(results => {
        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value) {
            if (res.value.streams) foundStreams.push(...res.value.streams);
            if (res.value.subtitles) foundSubtitles.push(...res.value.subtitles);
          }
        });
      })
    );

    // 4. Wait for resolution (Max 12 seconds total timeout for all concurrent tasks)
    await Promise.race([
      Promise.all(scrapeTasks),
      new Promise(resolve => setTimeout(resolve, 12000))
    ]);

    if (foundStreams.length === 0) {
      console.warn('[UniversalAggregator] ALL scrapers returned empty.');
    }

    const uniqueStreamsMap = new Map<string, UniversalStream>();
    foundStreams.forEach(stream => {
      if (!stream.video_url) return;
      
      let finalUrl = stream.video_url;
      
      // Unwrap internal OMSS/Cinepro localhost proxies
      if (finalUrl.includes('localhost')) {
        try {
          const urlObj = new URL(finalUrl);
          const dataParam = urlObj.searchParams.get('data');
          if (dataParam) {
             const decoded = JSON.parse(decodeURIComponent(dataParam));
             if (decoded.url) finalUrl = decoded.url;
          } else {
             const urlParam = urlObj.searchParams.get('url');
             if (urlParam) finalUrl = decodeURIComponent(urlParam);
          }
        } catch (e) {
          // Ignore parse errors, just fallback to checking localhost below
        }
        
        // Failsafe: if it STILL is localhost after unwrapping, drop it
        if (finalUrl.includes('localhost')) return;
      }
      
      const key = `${finalUrl.trim()}`;
      if (!uniqueStreamsMap.has(key)) {
        uniqueStreamsMap.set(key, {
          language: stream.language || this.classifyLanguage(`${stream.source_name} ${finalUrl}`),
          video_url: finalUrl,
          video_type: stream.video_type || (finalUrl.includes('.m3u8') ? 'm3u8' : 'mp4'),
          source_name: stream.source_name,
          referer: stream.referer
        });
      }
    });

    const deduplicatedStreams = Array.from(uniqueStreamsMap.values());

    const uniqueSubtitlesMap = new Map<string, UniversalSubtitle>();
    foundSubtitles.forEach(sub => {
      if (!sub.url) return;
      uniqueSubtitlesMap.set(sub.url, sub);
    });
    const deduplicatedSubtitles = Array.from(uniqueSubtitlesMap.values());

    console.log(`[UniversalAggregator] Deduplicated streams down to ${deduplicatedStreams.length} entries.`);

    // 5. Save to Cache
    if (deduplicatedStreams.length > 0) {
      try {
        // Clear previous stale cache
        await supabase
          .from('cached_streams')
          .delete()
          .eq('media_id', mediaId)
          .eq('season', season)
          .eq('episode', episode);

        // Batch insert new records
        const streamRows = deduplicatedStreams.map(stream => ({
          media_id: mediaId,
          season,
          episode,
          source_name: stream.source_name,
          video_url: stream.video_url,
          language: stream.language,
          video_type: stream.video_type
        }));

        await supabase.from('cached_streams').insert(streamRows);

        // Subtitles Cache
        await supabase
          .from('cached_subtitles')
          .delete()
          .eq('media_id', mediaId)
          .eq('season', season)
          .eq('episode', episode);

        if (deduplicatedSubtitles.length > 0) {
          await supabase.from('cached_subtitles').insert({
            media_id: mediaId,
            season,
            episode,
            subtitles: deduplicatedSubtitles
          });
        }

        console.log(`[UniversalAggregator] Cached ${deduplicatedStreams.length} streams in Supabase.`);
      } catch (dbSaveErr) {
        console.error('[UniversalAggregator] Failed to write cache to Supabase:', dbSaveErr);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[UniversalAggregator] Completed aggregation in ${duration}ms`);

    return {
      success: deduplicatedStreams.length > 0,
      streams: deduplicatedStreams,
      subtitles: deduplicatedSubtitles
    };
  }

  /**
   * Helper to inspect titles, source urls, and metadata strings for dub indicators
   */
  classifyLanguage(titleOrMeta: string): 'eng-dub' | 'hin-dub' | 'sub' {
    const norm = titleOrMeta.toLowerCase();
    if (norm.includes('hindi') || norm.includes('hin-dub') || norm.includes('dual audio') || norm.includes('hin')) {
      return 'hin-dub';
    }
    if (norm.includes('dubbed') || norm.includes('eng-dub') || norm.includes('english') || norm.includes('eng') || norm.includes('dub')) {
      return 'eng-dub';
    }
    return 'sub';
  }

  // ═══════════════════════════════════════════════════════════════
  // PROVIDER-SPECIFIC SCRAPERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * AnimePahe
   */
  private async scrapeAnimePahe(query: string, episode: number): Promise<UniversalStream[]> {
    const streams: UniversalStream[] = [];
    try {
      const searchRes = await stealthClient.get(`https://animepahe.ru/api?m=search&q=${encodeURIComponent(query)}`, { timeout: 4000 });
      const matched = searchRes.data?.data?.[0];
      if (!matched?.session) return [];

      const releasesRes = await stealthClient.get(`https://animepahe.ru/api?m=release&id=${matched.session}&sort=actual-desc`, { timeout: 4000 });
      const epData = releasesRes.data?.data?.find((ep: any) => ep.episode === episode);
      if (!epData?.session) return [];

      // Extract streams using playwright since AnimePahe employs Kwink/Ddownload players with cookies/headers protection
      const playUrl = `https://animepahe.ru/play/${matched.session}/${epData.session}`;
      const playwrightStreams = await this.scrapeWithPlaywright(playUrl, 'animepahe');
      streams.push(...playwrightStreams);
    } catch (e) {}
    return streams;
  }

  /**
   * AllWish
   */
  private async scrapeAllWish(query: string, episode: number): Promise<UniversalStream[]> {
    const streams: UniversalStream[] = [];
    try {
      const searchRes = await stealthClient.get(`https://allwish.me/?s=${encodeURIComponent(query)}`, { timeout: 4000 });
      const $ = cheerio.load(searchRes.data);
      const firstArticle = $('article').first();
      const link = firstArticle.find('a').attr('href');
      if (!link) return [];

      // Load post, click play and extract using Playwright
      const playwrightStreams = await this.scrapeWithPlaywright(link, 'allwish');
      streams.push(...playwrightStreams);
    } catch (e) {}
    return streams;
  }

  /**
   * AnimeKhor
   */
  private async scrapeAnimeKhor(query: string, episode: number): Promise<UniversalStream[]> {
    const streams: UniversalStream[] = [];
    try {
      const searchRes = await stealthClient.get(`https://animekhor.org/?s=${encodeURIComponent(query)}`, { timeout: 4000 });
      const $ = cheerio.load(searchRes.data);
      const link = $('.post-title a, h2 a').first().attr('href');
      if (!link) return [];

      const playwrightStreams = await this.scrapeWithPlaywright(link, 'animekhor');
      streams.push(...playwrightStreams);
    } catch (e) {}
    return streams;
  }

  /**
   * Vidnest
   */
  private async scrapeVidnest(
    tmdbId: string,
    type: 'movie' | 'tv',
    season: number,
    episode: number
  ): Promise<{ streams: UniversalStream[], subtitles: UniversalSubtitle[] }> {
    const result = { streams: [] as UniversalStream[], subtitles: [] as UniversalSubtitle[] };
    try {
      const { VidNestProvider } = await import('./cinepro-providers/vidnest/vidnest');
      const provider = new VidNestProvider();
      
      const media = type === 'movie' 
        ? await provider.getMovieSources({ type: 'movie', tmdbId } as any)
        : await provider.getTVSources({ type: 'tv', tmdbId, s: season, e: episode } as any);

      if (media.sources) {
        media.sources.forEach(src => {
          const lang = this.classifyLanguage(`${src.quality} ${src.url}`);
          result.streams.push({
            language: lang,
            video_url: src.url,
            video_type: src.type === 'hls' ? 'm3u8' : 'mp4',
            source_name: 'vidnest'
          });
        });
      }

      if (media.subtitles) {
        media.subtitles.forEach(sub => {
          result.subtitles.push({
            label: sub.label,
            url: sub.url,
            lang: sub.label.toLowerCase().substring(0, 2)
          });
        });
      }
    } catch (e) {
      console.warn('[UniversalAggregator] Vidnest scraping failed:', e);
    }
    return result;
  }

  /**
   * Vegamovies
   */
  private async scrapeVegamovies(query: string, season: number, episode: number): Promise<UniversalStream[]> {
    const streams: UniversalStream[] = [];
    try {
      // Vegamovies usually provides direct G-Drive/Hub Cloud redirects which resolve to mp4/m3u8 files
      const searchRes = await stealthClient.get(`https://vegamovies.lol/?s=${encodeURIComponent(query)}`, { timeout: 4000 });
      const $ = cheerio.load(searchRes.data);
      const postUrl = $('.entry-title a, .post-title a').first().attr('href');
      if (!postUrl) return [];

      const playwrightStreams = await this.scrapeWithPlaywright(postUrl, 'vegamovies');
      streams.push(...playwrightStreams);
    } catch (e) {}
    return streams;
  }

  /**
   * KatmovieHD
   */
  private async scrapeKatmovieHD(query: string, season: number, episode: number): Promise<UniversalStream[]> {
    const streams: UniversalStream[] = [];
    try {
      const searchRes = await stealthClient.get(`https://katmoviehd.cx/?s=${encodeURIComponent(query)}`, { timeout: 4000 });
      const $ = cheerio.load(searchRes.data);
      const postUrl = $('.post-title a, h2 a').first().attr('href');
      if (!postUrl) return [];

      const playwrightStreams = await this.scrapeWithPlaywright(postUrl, 'katmoviehd');
      streams.push(...playwrightStreams);
    } catch (e) {}
    return streams;
  }

  /**
   * KissKH
   */
  private async scrapeKissKH(query: string, episode: number): Promise<{ streams: UniversalStream[], subtitles: UniversalSubtitle[] }> {
    const streams: UniversalStream[] = [];
    const subtitles: UniversalSubtitle[] = [];
    try {
      const searchUrl = `https://kisskh.co/api/Drama?q=${encodeURIComponent(query)}&type=0`;
      const searchRes = await stealthClient.get(searchUrl, { timeout: 4000 });
      const drama = searchRes.data?.[0];
      if (!drama?.id) return { streams, subtitles };

      const detailUrl = `https://kisskh.co/api/Drama/${drama.id}?episodeId=0`;
      const detailRes = await stealthClient.get(detailUrl, { timeout: 4000 });
      const targetEp = detailRes.data?.episodes?.find((ep: any) => ep.number === episode);
      if (!targetEp?.id) return { streams, subtitles };

      const streamUrl = `https://kisskh.co/api/Drama/EpisodeSources/${targetEp.id}`;
      const sourcesRes = await stealthClient.get(streamUrl, { timeout: 4000 });
      
      const videoData = sourcesRes.data;
      if (videoData?.Video) {
        streams.push({
          language: this.classifyLanguage(drama.name + ' ' + videoData.Video),
          video_url: videoData.Video,
          video_type: videoData.Video.includes('.m3u8') ? 'm3u8' : 'mp4',
          source_name: 'kisskh'
        });
      }

      if (videoData?.Subtitles && Array.isArray(videoData.Subtitles)) {
        videoData.Subtitles.forEach((sub: any) => {
          if (sub.src) {
            subtitles.push({
              label: sub.label || 'English',
              url: sub.src,
              lang: sub.lang || 'en'
            });
          }
        });
      }
    } catch (e) {}
    return { streams, subtitles };
  }

  /**
   * Dramaday
   */
  private async scrapeDramaday(query: string, season: number, episode: number): Promise<UniversalStream[]> {
    const streams: UniversalStream[] = [];
    try {
      const searchRes = await stealthClient.get(`https://dramaday.me/?s=${encodeURIComponent(query)}`, { timeout: 4000 });
      const $ = cheerio.load(searchRes.data);
      const postUrl = $('.entry-title a, .post-title a').first().attr('href');
      if (!postUrl) return [];

      const playwrightStreams = await this.scrapeWithPlaywright(postUrl, 'dramaday');
      streams.push(...playwrightStreams);
    } catch (e) {}
    return streams;
  }

  /**
   * Reusable Playwright interceptor for Cloudflare/JS challenge protected pages.
   * Guarantees strict browser.close() in a finally block.
   */
  private async scrapeWithPlaywright(url: string, sourceName: string): Promise<UniversalStream[]> {
    let browser: any = null;
    const streams: UniversalStream[] = [];
    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();

      // Intercept network requests for media sources
      page.on('response', (response: any) => {
        const reqUrl = response.url();
        if ((reqUrl.includes('.m3u8') || reqUrl.includes('.mp4')) && 
            !reqUrl.includes('master.m3u8') && 
            !reqUrl.includes('blank.m3u8')) {
          
          const type = reqUrl.includes('.m3u8') ? 'm3u8' : 'mp4';
          const lang = this.classifyLanguage(`${sourceName} ${reqUrl}`);

          streams.push({
            language: lang,
            video_url: reqUrl,
            video_type: type as any,
            source_name: sourceName
          });
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
      
      // Wait for async loads/trigger play button
      await page.waitForTimeout(2000);
      try {
        await page.mouse.click(500, 500); // Click center to trigger player load
        await page.evaluate(() => {
          const btn = document.querySelector('.play-btn, button[aria-label="Play"], .vjs-big-play-button') as HTMLElement;
          if (btn) btn.click();
        });
      } catch (e) {}
      await page.waitForTimeout(3000);

    } catch (err) {
      console.warn(`[Playwright Scrape] Failed for ${url}:`, err);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
    return streams;
  }
}
