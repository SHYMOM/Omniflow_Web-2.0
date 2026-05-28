import type { ProviderMediaObject } from '@omss/framework';
import { StealthHttpClient } from '../../stealth-client';

export class VidLinkProvider {
  name = 'VidLink';
  private client = new StealthHttpClient();

  async getMovieSources(media: ProviderMediaObject) {
    const res = await this.client.get(`https://vidlink.pro/api/movie/${media.tmdbId}`);
    return this.parseResponse(res.data);
  }

  async getTVSources(media: ProviderMediaObject) {
    const res = await this.client.get(`https://vidlink.pro/api/tv/${media.tmdbId}/${media.s}/${media.e}`);
    return this.parseResponse(res.data);
  }

  private parseResponse(data: any) {
    if (!data || !data.stream || !data.stream.length) {
      return { sources: [], subtitles: [] };
    }

    // Vidlink returns an array of streams
    const sources = data.stream.map((s: any) => ({
      url: s.file || s.link || s.url,
      quality: s.quality || 'auto',
      type: s.type || 'hls',
      isM3U8: (s.file || s.link || s.url || '').includes('.m3u8')
    }));

    // Some endpoints may return subtitles
    const subtitles = (data.subtitles || []).map((sub: any) => ({
      url: sub.file || sub.url,
      label: sub.label || sub.language || 'English',
      lang: sub.language || 'en'
    }));

    return { sources, subtitles };
  }
}
