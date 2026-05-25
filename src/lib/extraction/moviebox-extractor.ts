import { IStreamResult, IStreamSource, IStreamSubtitle } from '@/types/extraction-types';
import { StealthHttpClient } from './stealth-client';

export class MovieboxExtractor {
  private stealthClient: StealthHttpClient;

  constructor() {
    this.stealthClient = new StealthHttpClient();
  }

  async extractDirectStream(
    title: string,
    mediaType: 'movie' | 'tv',
    episode: number = 1,
    season: number = 1
  ): Promise<IStreamResult> {
    try {
      // 1. Search for the media to get detailPath
      const searchUrl = 'https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/search';
      const searchPayload = { keyword: title, perPage: 10, page: 1 };
      const searchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json'
      };

      const searchResp = await this.stealthClient.post(searchUrl, searchPayload, { headers: searchHeaders, timeout: 8000 });
      if (!searchResp.data?.data?.items?.length) {
        throw new Error('Moviebox: No search results found');
      }

      // We pick the first matching item
      const item = searchResp.data.data.items.find((i: any) => 
        i.title?.toLowerCase().includes(title.toLowerCase()) || 
        title.toLowerCase().includes(i.title?.toLowerCase())
      ) || searchResp.data.data.items[0];

      const detailPath = item.detailPath;
      if (!detailPath) {
        throw new Error('Moviebox: detailPath missing');
      }

      // 2. Fetch the detail page to get subjectId from NUXT data
      const detailUrl = `https://moviebox.ph/detail/${detailPath}`;
      const detailResp = await this.stealthClient.get(detailUrl, { headers: searchHeaders, timeout: 8000 });
      
      const nuxtMatch = detailResp.data?.match(/<script type="application\/json" data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/);
      if (!nuxtMatch) {
        throw new Error('Moviebox: Could not find __NUXT_DATA__');
      }

      let nuxtJson: any[];
      try {
        nuxtJson = JSON.parse(nuxtMatch[1]);
      } catch (e) {
        throw new Error('Moviebox: Failed to parse NUXT data');
      }

      let subjectId = '';
      for (const val of nuxtJson) {
        if (val && typeof val === 'object' && val.subjectId) {
          subjectId = val.subjectId;
          break;
        }
      }

      if (!subjectId) {
        throw new Error('Moviebox: Could not extract subjectId');
      }

      // 3. Get Stream domain
      const domainUrl = 'https://h5-api.aoneroom.com/wefeed-h5api-bff/media-player/get-domain';
      let streamDomain = 'https://123movienow.cc';
      try {
        const domResp = await this.stealthClient.get(domainUrl, { headers: searchHeaders, timeout: 3000 });
        if (domResp.data?.data) {
          streamDomain = domResp.data.data;
          if (streamDomain.endsWith('/')) {
            streamDomain = streamDomain.slice(0, -1);
          }
        }
      } catch (e) {
        // use fallback
      }

      // 4. Play URL
      const se = mediaType === 'movie' ? 0 : season;
      const ep = mediaType === 'movie' ? 0 : episode;

      const playUrl = `${streamDomain}/wefeed-h5api-bff/subject/play?subjectId=${subjectId}&se=${se}&ep=${ep}&detailPath=${detailPath}`;
      const playHeaders = {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        'referer': `${streamDomain}/spa/videoPlayPage/movies/${detailPath}?id=${subjectId}&type=/movie/detail&detailSe=&detailEp=&lang=en`,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-client-info': '{"timezone":"Asia/Dhaka"}',
        'x-source': ''
      };

      const playResp = await this.stealthClient.get(playUrl, { 
        headers: playHeaders, 
        // @ts-ignore
        cookies: { uuid: "d8c3539e-2e46-4000-af20-7046a856e30a" },
        timeout: 10000 
      });

      const streams = playResp.data?.data?.streams || [];
      if (!streams.length) {
        throw new Error('Moviebox: No streams returned by player API');
      }

      const sources: IStreamSource[] = streams.map((s: any) => ({
        url: s.url,
        quality: s.resolutions ? `${s.resolutions}p` : (s.format === 'm3u8' ? 'auto' : 'default'),
        isM3U8: s.format === 'm3u8' || s.url.includes('.m3u8'),
      }));

      // Find subtitles if they exist in nuxtJson or somewhere else, Moviebox usually has them in streams or separate
      // Assuming subtitle data is in `captions` array if available
      const subtitles: IStreamSubtitle[] = [];
      const subtitlesData = playResp.data?.data?.subtitles || playResp.data?.data?.captions || [];
      for (const sub of subtitlesData) {
        if (sub.url) {
          subtitles.push({
            url: sub.url,
            lang: sub.lang || sub.language || 'en',
            label: sub.label || sub.name || 'English',
            default: (sub.lang || sub.language) === 'en'
          });
        }
      }

      return {
        success: true,
        provider: 'moviebox',
        sources,
        subtitles,
        headers: {
          Referer: `${streamDomain}/`
        }
      };

    } catch (e: any) {
      console.warn(`[MovieboxExtractor] Failed:`, e.message);
      return {
        success: false,
        provider: 'moviebox',
        sources: [],
        subtitles: [],
        headers: {}
      };
    }
  }
}
