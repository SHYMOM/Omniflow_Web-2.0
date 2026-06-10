import { memoryCache } from '@/lib/cache/memory';
import { IStreamSubtitle } from '@/types/extraction-types';

export interface SubtitleSearchParams {
  imdbId?: string;
  tmdbId?: string | number;
  anilistId?: string | number;
  title?: string;
  season?: number;
  episode?: number;
  languages?: string[];
  existingSubs?: IStreamSubtitle[];
}

export class SubtitleService {
  /**
   * Convert SRT formatted string to WebVTT
   */
  static srtToVtt(srt: string): string {
    return 'WEBVTT\n\n' + srt
      .replace(/\r\n/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') // SRT time → VTT time
      .trim();
  }

  /**
   * Proxies URLs through our API so CORS and format conversions are handled
   */
  private static proxyUrl(url: string, isSrt: boolean = false): string {
    if (!url) return '';
    // If it's already proxied, return it
    if (url.includes('/api/stream/proxy')) return url;
    return `/api/stream/proxy?url=${encodeURIComponent(url)}${isSrt ? '&format=vtt' : ''}`;
  }

  /**
   * Source 1: Validate and format provider-embedded subtitles
   */
  static async validateProviderSubtitles(subtitles: IStreamSubtitle[]): Promise<IStreamSubtitle[]> {
    if (!subtitles || !subtitles.length) return [];
    
    return subtitles
      .filter(sub => sub.url && sub.url.length > 5)
      .map(sub => {
        const isSrt = sub.url.toLowerCase().endsWith('.srt');
        return {
          lang: this.normalizeLanguageCode(sub.lang),
          label: sub.label || this.getLanguageLabel(sub.lang),
          url: this.proxyUrl(sub.url, isSrt),
          default: sub.default
        };
      });
  }

  /**
   * Source 2: OpenSubtitles REST API (Free tier)
   */
  static async searchOpenSubtitles(params: SubtitleSearchParams): Promise<IStreamSubtitle[]> {
    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    if (!apiKey || (!params.imdbId && !params.tmdbId)) return [];

    try {
      const payload: any = {};
      if (params.imdbId) payload.imdb_id = params.imdbId.replace('tt', '');
      if (params.tmdbId) payload.tmdb_id = Number(params.tmdbId);
      if (params.season) payload.season_number = params.season;
      if (params.episode) payload.episode_number = params.episode;
      if (params.languages && params.languages.length > 0) {
        payload.languages = params.languages;
      }

      const res = await fetch('https://api.opensubtitles.com/api/v1/subtitles', {
        method: 'GET',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) return [];
      const data = await res.json();
      
      const subs: IStreamSubtitle[] = [];
      const seenLangs = new Set<string>();

      for (const sub of data.data || []) {
        const lang = this.normalizeLanguageCode(sub.attributes.language);
        if (!seenLangs.has(lang)) {
          // We must fetch the actual download URL using the file_id
          const fileId = sub.attributes.files[0]?.file_id;
          if (fileId) {
            seenLangs.add(lang);
            // The download URL has to be fetched via POST to /download
            const dlRes = await fetch('https://api.opensubtitles.com/api/v1/download', {
              method: 'POST',
              headers: {
                'Api-Key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({ file_id: fileId })
            });

            if (dlRes.ok) {
              const dlData = await dlRes.json();
              if (dlData.link) {
                subs.push({
                  lang,
                  label: this.getLanguageLabel(lang) + ' (OS)',
                  url: this.proxyUrl(dlData.link, true)
                });
              }
            }
          }
        }
      }
      return subs;
    } catch (e) {
      console.error('[SubtitleService] OpenSubtitles search failed:', e);
      return [];
    }
  }

  /**
   * Source 3: SubDL API (Free)
   */
  static async searchSubDL(params: SubtitleSearchParams): Promise<IStreamSubtitle[]> {
    if (!params.tmdbId || !params.season || !params.episode) return [];
    const apiKey = process.env.SUBDL_API_KEY || ''; // Free tier often works without key

    try {
      const url = `https://subdl.com/api/v1/subtitles/?api_key=${apiKey}&tmdb_id=${params.tmdbId}&season_number=${params.season}&episode_number=${params.episode}&languages=EN,HI,ES,FR,DE,JA`;
      const res = await fetch(url);
      if (!res.ok) return [];
      
      const data = await res.json();
      if (!data.status || !data.subtitles) return [];

      const subs: IStreamSubtitle[] = [];
      const seenLangs = new Set<string>();

      for (const sub of data.subtitles) {
        const lang = this.normalizeLanguageCode(sub.language);
        if (!seenLangs.has(lang) && sub.url) {
          seenLangs.add(lang);
          subs.push({
            lang,
            label: this.getLanguageLabel(lang) + ' (SubDL)',
            url: this.proxyUrl('https://subdl.com' + sub.url, true)
          });
        }
      }
      return subs;
    } catch (e) {
      console.warn('[SubtitleService] SubDL search failed:', e);
      return [];
    }
  }

  /**
   * Aggregate all subtitle sources
   */
  static async getSubtitles(params: SubtitleSearchParams): Promise<IStreamSubtitle[]> {
    const cacheKey = `subs:${params.tmdbId || params.anilistId}:${params.season}:${params.episode}`;
    const cached = memoryCache.get<IStreamSubtitle[]>(cacheKey);
    if (cached && cached.length > 0) return cached;

    const [providerSubs, osSubs, subdlSubs] = await Promise.allSettled([
      this.validateProviderSubtitles(params.existingSubs || []),
      this.searchOpenSubtitles(params),
      this.searchSubDL(params)
    ]);

    const finalSubs: IStreamSubtitle[] = [];
    const seenLangs = new Set<string>();

    // Priority 1: Provider embedded
    if (providerSubs.status === 'fulfilled') {
      for (const sub of providerSubs.value) {
        if (!seenLangs.has(sub.lang)) {
          seenLangs.add(sub.lang);
          finalSubs.push(sub);
        }
      }
    }

    // Priority 2: OpenSubtitles
    if (osSubs.status === 'fulfilled') {
      for (const sub of osSubs.value) {
        if (!seenLangs.has(sub.lang)) {
          seenLangs.add(sub.lang);
          finalSubs.push(sub);
        }
      }
    }

    // Priority 3: SubDL
    if (subdlSubs.status === 'fulfilled') {
      for (const sub of subdlSubs.value) {
        if (!seenLangs.has(sub.lang)) {
          seenLangs.add(sub.lang);
          finalSubs.push(sub);
        }
      }
    }

    if (finalSubs.length > 0) {
      memoryCache.set(cacheKey, finalSubs);
    }
    return finalSubs;
  }

  // Helpers
  private static normalizeLanguageCode(lang: string): string {
    const l = lang.toLowerCase();
    if (l.includes('eng') || l === 'en') return 'en';
    if (l.includes('hin') || l === 'hi') return 'hi';
    if (l.includes('spa') || l === 'es') return 'es';
    if (l.includes('fre') || l === 'fr') return 'fr';
    if (l.includes('ger') || l === 'de') return 'de';
    if (l.includes('jpn') || l === 'ja') return 'ja';
    return l.substring(0, 2);
  }

  private static getLanguageLabel(code: string): string {
    const map: Record<string, string> = {
      'en': 'English',
      'hi': 'Hindi',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh': 'Chinese',
      'ru': 'Russian',
      'ar': 'Arabic',
      'pt': 'Portuguese',
      'it': 'Italian',
    };
    return map[code] || code.toUpperCase();
  }
}
