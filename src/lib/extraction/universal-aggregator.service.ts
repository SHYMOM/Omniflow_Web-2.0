import * as cheerio from 'cheerio';
import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { expandQuery } from './query-expander';
import { StealthHttpClient } from './stealth-client';
import { PLAYWRIGHT_ENABLED } from './extraction-config';
import { logger } from '../logger';

const stealthClient = new StealthHttpClient();

// Semaphore: cap concurrent Playwright browser launches to avoid OOM.
// Each Chromium process consumes ~200-400MB RAM; we allow at most 2 at once.
const PLAYWRIGHT_CONCURRENCY = 2;
let playwrightActive = 0;
const playwrightQueue: Array<() => void> = [];

function acquirePlaywrightSlot(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (playwrightActive < PLAYWRIGHT_CONCURRENCY) {
        playwrightActive++;
        resolve(() => {
          playwrightActive--;
          const next = playwrightQueue.shift();
          if (next) next();
        });
      } else {
        playwrightQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

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
  private activeAggregations = new Map<string, Promise<UniversalAggregationResult>>();

  /**
   * Main orchestrator to fetch aggregated streams.
   * Checks Supabase cache first, and cascades to scraping on a cache miss.
   * Leverages request coalescing to deduplicate concurrent requests.
   */
  async aggregate(
    mediaId: string,
    mediaType: 'anime' | 'movie' | 'tv' | 'kdrama',
    season = 1,
    episode = 1,
    language?: string,
    imdbId?: string,
    onProgress?: (event: string, data: any) => void
  ): Promise<UniversalAggregationResult> {
    const key = `${mediaType}:${mediaId}:${season}:${episode}:${language || 'sub'}:${imdbId || ''}`;
    
    let ongoing = this.activeAggregations.get(key);
    if (ongoing) {
      console.log(`[UniversalAggregator] Coalescing concurrent request for key: ${key}`);
      return ongoing;
    }
    
    const promise = this.performAggregation(mediaId, mediaType, season, episode, language, imdbId, onProgress);
    this.activeAggregations.set(key, promise);
    
    try {
      return await promise;
    } finally {
      this.activeAggregations.delete(key);
    }
  }

  async performAggregation(
    mediaId: string,
    mediaType: 'anime' | 'movie' | 'tv' | 'kdrama',
    season = 1,
    episode = 1,
    language?: string,
    imdbId?: string,
    onProgress?: (event: string, data: any) => void
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
        .gt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()); // 15 mins TTL

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
        const validStreams = cachedStreams;
        
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
    const { queries, primaryTitle, tmdbId, imdbId: resolvedImdbId, expectedDuration } = await expandQuery(mediaId, mediaType, season);
    const finalImdbId = imdbId || resolvedImdbId;
    console.log(`[UniversalAggregator] Expanded "${primaryTitle}" to ${queries.length} search variations. IMDB: ${finalImdbId}`);

    // Calculate minimum required duration in seconds to prevent trailer / ad-prefixed snippets
    let minDurationSec = 600; // default 10 minutes
    if (mediaType === 'movie') {
      minDurationSec = 2700; // default 45 minutes
    }
    if (expectedDuration) {
      minDurationSec = Math.max(120, expectedDuration * 60 * 0.5); // at least 2 minutes, or 50% of expected duration
    }
    console.log(`[UniversalAggregator] Expected Media Duration: ${expectedDuration || 'unknown'} mins. Enforcing minimum duration gate: ${minDurationSec} seconds.`);

    // 3. Parallel Provider Blast Setup
    const allTasks: Promise<{ streams: UniversalStream[], subtitles: UniversalSubtitle[], provider: string }>[] = [];
    const topQueries = queries.slice(0, 2);

    // ═══ CORE EXTRACTION SERVICES (each as independent task, not wrapped in one) ═══

    // Anime: Use AnimeExtractionService which internally cascades through providers
    if (mediaType === 'anime') {
      const animeCoreTask = (async () => {
        const streams: UniversalStream[] = [];
        const subtitles: UniversalSubtitle[] = [];
        try {
          const { AnimeExtractionService } = await import('./anime-extraction.service');
          const animeService = new AnimeExtractionService();
          const coreAnime = await animeService.extractSources({
            mediaId,
            title: primaryTitle,
            episode,
            mediaType: 'anime',
            language: language || 'sub'
          });
          if (coreAnime.success && coreAnime.sources) {
            coreAnime.sources.forEach((src: any) => {
              const lang = src.language || this.classifyLanguage(`${primaryTitle} ${src.quality}`);
              let referer = src.referer || coreAnime.headers?.Referer || '';
              if (!referer && coreAnime.provider?.includes('pahe')) referer = 'https://animepahe.com/';
              streams.push({
                language: lang,
                video_url: src.url,
                video_type: src.isM3U8 ? 'm3u8' : 'mp4',
                source_name: coreAnime.provider || 'core-anime',
                referer
              });
            });
            if (coreAnime.subtitles) {
              coreAnime.subtitles.forEach((sub: any) => {
                subtitles.push({ label: sub.label, url: sub.url, lang: sub.lang });
              });
            }
          }
        } catch (e) {
          console.error('[Core Anime] error:', e);
        }
        return { streams, subtitles, provider: 'core-anime' };
      })();
      allTasks.push(animeCoreTask);

      // Anime embed fallback via Cinepro (if TMDB ID is available from query expansion)
      if (tmdbId) {
        const animeCineproTask = (async () => {
          const streams: UniversalStream[] = [];
          const subtitles: UniversalSubtitle[] = [];
          try {
            const { CineproAggregator } = await import('./cinepro-aggregator');
            const cinepro = new CineproAggregator();
            const coreMovie = await cinepro.scrapeSeries(tmdbId, season, episode, finalImdbId);
            if (coreMovie.sources && coreMovie.sources.length > 0) {
              coreMovie.sources.forEach(src => {
                const lang = this.classifyLanguage(`${primaryTitle} ${src.url}`);
                streams.push({
                  language: lang,
                  video_url: src.url,
                  video_type: src.isM3U8 ? 'm3u8' : 'mp4',
                  source_name: src.provider?.id ? `cinepro-${src.provider.id}` : 'cinepro-core',
                  referer: src.referer || ''
                });
              });
              if (coreMovie.subtitles) {
                coreMovie.subtitles.forEach(sub => {
                  subtitles.push({ label: sub.label, url: sub.url, lang: sub.lang });
                });
              }
            }
          } catch (e) {
            console.error('[Anime Cinepro] error:', e);
          }
          return { streams, subtitles, provider: 'anime-cinepro' };
        })();
        allTasks.push(animeCineproTask);
      }
    } else {
      // Movie/TV: Cinepro core
      if (tmdbId) {
        const coreMovieTask = (async () => {
          const streams: UniversalStream[] = [];
          const subtitles: UniversalSubtitle[] = [];
          try {
            const { CineproAggregator } = await import('./cinepro-aggregator');
            const cinepro = new CineproAggregator();
            const coreMovie = await (mediaType === 'movie'
              ? cinepro.scrapeMovie(tmdbId, finalImdbId)
              : cinepro.scrapeSeries(tmdbId, season, episode, finalImdbId)
            );
            if (coreMovie.sources && coreMovie.sources.length > 0) {
              coreMovie.sources.forEach(src => {
                const lang = this.classifyLanguage(`${primaryTitle} ${src.url}`);
                streams.push({
                  language: lang,
                  video_url: src.url,
                  video_type: src.isM3U8 ? 'm3u8' : 'mp4',
                  source_name: src.provider?.id ? `cinepro-${src.provider.id}` : 'cinepro-core',
                  referer: src.referer || ''
                });
              });
              if (coreMovie.subtitles) {
                coreMovie.subtitles.forEach(sub => {
                  subtitles.push({ label: sub.label, url: sub.url, lang: sub.lang });
                });
              }
            }
          } catch (e) {
            console.error('[Core Movie] error:', e);
          }
          return { streams, subtitles, provider: 'cinepro' };
        })();
        allTasks.push(coreMovieTask);
      }
    }

    // EMBED PROVIDER SCRAPER (runs via Playwright network interception for IMDB/TMDB IDs)
    const scrapeTargetId = finalImdbId || tmdbId;
    if (scrapeTargetId && (mediaType === 'movie' || mediaType === 'tv' || mediaType === 'anime') && PLAYWRIGHT_ENABLED) {
      const embedTask = (async () => {
        const streams: UniversalStream[] = [];
        const subtitles: UniversalSubtitle[] = [];
        try {
          const { EmbedProviderAggregator } = await import('./embed-provider-aggregator');
          const embedAgg = new EmbedProviderAggregator();
          const result = mediaType === 'movie'
            ? await embedAgg.scrapeMovie(scrapeTargetId)
            : await embedAgg.scrapeSeries(scrapeTargetId, season, episode);

          if (result?.sources && result.sources.length > 0) {
            result.sources.forEach(src => {
              const lang = this.classifyLanguage(`${primaryTitle} ${src.url}`);
              streams.push({
                language: lang,
                video_url: src.url,
                video_type: src.isM3U8 ? 'm3u8' : 'mp4',
                source_name: `embed-${(src.provider as any)?.id || 'embed'}`,
                referer: src.referer || ''
              });
            });
          }
          if (result?.subtitles) {
            result.subtitles.forEach(sub => {
              subtitles.push({ label: sub.label, url: sub.url, lang: sub.lang });
            });
          }
        } catch (e) {
          console.error('[EmbedAggregator] error:', e);
        }
        return { streams, subtitles, provider: 'embed-providers' };
      })();
      allTasks.push(embedTask);
    }

    // PLAYWRIGHT SCRAPERS (Secondary, slower — only if PLAYWRIGHT_ENABLED)
    if (PLAYWRIGHT_ENABLED) {
      if (mediaType === 'anime') {
        topQueries.forEach(query => {
          allTasks.push(
            this.scrapeAnimePahe(query, episode).then(s => ({ streams: s, subtitles: [], provider: 'animepahe' })),
            this.scrapeAllWish(query, episode).then(s => ({ streams: s, subtitles: [], provider: 'allwish' })),
            this.scrapeAnimeKhor(query, episode).then(s => ({ streams: s, subtitles: [], provider: 'animekhor' }))
          );
        });
      } else if (mediaType === 'movie' || mediaType === 'tv') {
        topQueries.forEach(query => {
          allTasks.push(
            this.scrapeVegamovies(query, season, episode).then(s => ({ streams: s, subtitles: [], provider: 'vegamovies' })),
            this.scrapeKatmovieHD(query, season, episode).then(s => ({ streams: s, subtitles: [], provider: 'katmoviehd' }))
          );
        });
      } else if (mediaType === 'kdrama') {
        topQueries.forEach(query => {
          allTasks.push(
            this.scrapeKissKH(query, episode).then(res => ({ streams: res.streams, subtitles: res.subtitles, provider: 'kisskh' })),
            this.scrapeDramaday(query, season, episode).then(s => ({ streams: s, subtitles: [], provider: 'dramaday' }))
          );
        });
      }
    }

    // STREMIO ADDON FALLBACK — works for movies, tv, anime with IMDB IDs
    if ((mediaType === 'movie' || mediaType === 'tv' || mediaType === 'anime') && (finalImdbId || tmdbId)) {
      const stremioTask = (async () => {
        const streams: UniversalStream[] = [];
        try {
          const { StremioExtractor } = await import('./stremio-extractor');
          const extractor = new StremioExtractor();
          const result = await extractor.extractDirectStream(
            String(tmdbId || mediaId.replace(/[^\d]/g, '')),
            mediaType as 'movie' | 'tv' | 'anime',
            episode,
            season,
            finalImdbId || undefined
          );
          if (result.success && result.sources) {
            result.sources.forEach((src: any) => {
              streams.push({
                language: 'sub',
                video_url: src.url,
                video_type: src.isM3U8 ? 'm3u8' : 'mp4',
                source_name: 'stremio-addons',
              });
            });
          }
        } catch (e) {
          console.warn('[StremioFallback] error:', e);
        }
        return { streams, subtitles: [], provider: 'stremio-addons' };
      })();
      allTasks.push(stremioTask);
    }

    // Custom helper for first-win resolver — fast path (NO blocking HLS validation)
    const firstSuccess = (
      tasks: Promise<{ streams: UniversalStream[], subtitles: UniversalSubtitle[], provider: string }>[],
      timeoutMs: number
    ): Promise<{ streams: UniversalStream[], subtitles: UniversalSubtitle[] }[]> => {
      return new Promise((resolve) => {
        let resolved = false;
        let completedCount = 0;
        const successfulResults: { streams: UniversalStream[], subtitles: UniversalSubtitle[] }[] = [];

        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(successfulResults);
          }
        }, timeoutMs);

        tasks.forEach(p => {
          p.then(async (res) => {
            completedCount++;
            if (res && res.streams && res.streams.length > 0) {
              // Fast path: accept streams immediately without blocking HLS validation.
              // Quality/duration validation happens in the background cache-update path.
              if (onProgress) onProgress('provider_success', { provider: res.provider, streams: res.streams });
              successfulResults.push({ streams: res.streams, subtitles: res.subtitles });
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve(successfulResults);
              }
            } else if (completedCount === tasks.length) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve(successfulResults);
              }
            }
          }).catch(() => {
            completedCount++;
            if (completedCount === tasks.length) {
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve(successfulResults);
              }
            }
          });
        });
      });
    };

    // 4. Wait for the first success (hard timeout — don't keep users waiting)
    const initialResults = await firstSuccess(allTasks, 8000);
    
    // Extract what we found so far to return immediately
    const foundStreams: UniversalStream[] = [];
    const foundSubtitles: UniversalSubtitle[] = [];
    initialResults.forEach(res => {
      foundStreams.push(...res.streams);
      foundSubtitles.push(...res.subtitles);
    });

    const deduplicatedStreams = this.deduplicateStreams(foundStreams);
    const deduplicatedSubtitles = this.deduplicateSubtitles(foundSubtitles);

    // Trigger background cache filling and settling of all other tasks
    Promise.allSettled(allTasks).then(async (results) => {
      const allStreams: UniversalStream[] = [];
      const allSubtitles: UniversalSubtitle[] = [];
      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          allStreams.push(...res.value.streams);
          allSubtitles.push(...res.value.subtitles);
        }
      });
      
      // Filter out low-quality/fake streams from background scrapers before caching
      const validStreams: UniversalStream[] = [];
      for (const stream of allStreams) {
        const check = await this.validateHLSPresentation(stream.video_url, stream.referer, minDurationSec);
        if (check.valid) {
          validStreams.push(stream);
        }
      }
      
      await this.saveCache(mediaId, season, episode, validStreams, allSubtitles);
    }).catch(err => {
      console.error('[UniversalAggregator] Background tasks error:', err);
    });

    const duration = Date.now() - startTime;
    console.log(`[UniversalAggregator] First-win resolved in ${duration}ms. Streams found: ${deduplicatedStreams.length}`);

    return {
      success: deduplicatedStreams.length > 0,
      streams: deduplicatedStreams,
      subtitles: deduplicatedSubtitles
    };
  }

  private deduplicateStreams(streams: UniversalStream[]): UniversalStream[] {
    const uniqueStreamsMap = new Map<string, UniversalStream>();
    streams.forEach(stream => {
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
          // Ignore parse errors
        }
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
    return Array.from(uniqueStreamsMap.values());
  }

  private deduplicateSubtitles(subtitles: UniversalSubtitle[]): UniversalSubtitle[] {
    const uniqueSubtitlesMap = new Map<string, UniversalSubtitle>();
    subtitles.forEach(sub => {
      if (!sub.url) return;
      uniqueSubtitlesMap.set(sub.url, sub);
    });
    return Array.from(uniqueSubtitlesMap.values());
  }

  private async saveCache(
    mediaId: string,
    season: number,
    episode: number,
    streams: UniversalStream[],
    subtitles: UniversalSubtitle[]
  ) {
    const deduplicatedStreams = this.deduplicateStreams(streams);
    const deduplicatedSubtitles = this.deduplicateSubtitles(subtitles);

    if (deduplicatedStreams.length > 0) {
      try {
        // Auto-delete stale cache globally (> 3 hours old)
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('cached_streams')
          .delete()
          .lte('created_at', threeHoursAgo);
          
        await supabase
          .from('cached_subtitles')
          .delete()
          .lte('created_at', threeHoursAgo);

        // Clear previous stale cache for this specific item
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
  }

  /**
   * Normalize language tags for consistent matching.
   * Providers may return 'eng', 'eng-dub', 'dub', 'sub', 'hin', 'hin-dub', etc.
   * This maps them all to the canonical set: 'sub', 'eng-dub', 'hin-dub'.
   */
  classifyLanguage(titleOrMeta: string): 'eng-dub' | 'hin-dub' | 'sub' {
    const norm = titleOrMeta.toLowerCase();
    if (norm.includes('hindi') || norm.includes('hin-dub') || norm.includes('dual audio') || norm.includes('hin') || norm.includes('hi')) {
      return 'hin-dub';
    }
    if (norm.includes('dubbed') || norm.includes('eng-dub') || norm.includes('english') || norm.includes('eng') || norm.includes('dub') || norm === 'en') {
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
    // Acquire a semaphore slot to cap concurrent Chromium processes at PLAYWRIGHT_CONCURRENCY.
    const release = await acquirePlaywrightSlot();
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
      // Always release the semaphore slot, even on error
      release();
    }
    return streams;
  }

  private async validateHLSPresentation(
    url: string,
    referer?: string,
    minDurationSec: number = 600
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      if (referer) {
        headers['Referer'] = referer;
        try {
          headers['Origin'] = new URL(referer).origin;
        } catch {}
      }

      // Check for ad-server domains in the main URL first
      const adDomains = [
        'ibyteimg.com',
        'byteimg.com',
        'ad-site-i18n',
        'doubleclick',
        'googlesyndication',
        'criteo'
      ];
      const hasAdDomainInUrl = adDomains.some(domain => url.toLowerCase().includes(domain));
      if (hasAdDomainInUrl) {
        return { valid: false, reason: 'Detected advertisement/tracking hosting CDN in stream URL' };
      }

      if (!url.toLowerCase().includes('.m3u8') && !url.toLowerCase().includes('m3u8')) {
        // Direct MP4 check
        try {
          const headRes = await axios.head(url, { timeout: 3000, headers });
          if (headRes.status >= 400) {
            return { valid: false, reason: `MP4 returned status ${headRes.status}` };
          }
        } catch (err) {
          try {
            const getRes = await axios.get(url, {
              timeout: 3000,
              headers: { ...headers, Range: 'bytes=0-100' }
            });
            if (getRes.status >= 400) {
              return { valid: false, reason: `MP4 range request returned status ${getRes.status}` };
            }
          } catch (getErr) {
            return { valid: false, reason: `MP4 check failed: ${(getErr as Error).message}` };
          }
        }
        return { valid: true };
      }

      // HLS Check: Fetch playlist
      const res = await axios.get(url, { timeout: 3000, headers });
      const text = res.data;
      if (typeof text !== 'string') {
        return { valid: false, reason: 'Invalid playlist response type' };
      }

      let playlistText = text;
      let targetUrl = url;

      // Handle master playlist redirecting to media playlist
      if (text.includes('#EXT-X-STREAM-INF')) {
        const lines = text.split('\n');
        let firstMediaUrl = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            if (trimmed.startsWith('http')) {
              firstMediaUrl = trimmed;
            } else {
              firstMediaUrl = new URL(trimmed, url).href;
            }
            break;
          }
        }
        
        if (firstMediaUrl) {
          targetUrl = firstMediaUrl;
          const mediaRes = await axios.get(firstMediaUrl, { timeout: 3000, headers });
          playlistText = mediaRes.data;
          if (typeof playlistText !== 'string') {
            return { valid: false, reason: 'Invalid sub-playlist response type' };
          }
        } else {
          return { valid: false, reason: 'Empty master playlist' };
        }
      }

      // Check for ad-server domains in the playlist text/segment URLs
      const hasAdDomainInSegments = adDomains.some(domain => playlistText.toLowerCase().includes(domain));
      if (hasAdDomainInSegments) {
        return { valid: false, reason: 'Detected advertisement/tracking hosting CDN in playlist segments' };
      }

      // Parse and sum segment durations
      let totalDuration = 0;
      const lines = playlistText.split('\n');
      for (const line of lines) {
        if (line.startsWith('#EXTINF:')) {
          const val = parseFloat(line.replace('#EXTINF:', '').split(',')[0]);
          if (!isNaN(val)) {
            totalDuration += val;
          }
        }
      }

      if (totalDuration < minDurationSec) {
        return { valid: false, reason: `Stream duration too short: ${totalDuration.toFixed(1)}s (min required ${minDurationSec}s)` };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, reason: `Network error or block: ${(err as Error).message}` };
    }
  }
}
