import { VidNestProvider } from './cinepro-providers/vidnest/vidnest';
import { VidSrcProvider } from './cinepro-providers/vidsrc/vidsrc';
import { VidApiProvider } from './cinepro-providers/vidapi/vidapi';
import { VidLinkProvider } from './cinepro-providers/vidlink/vidlink';
import { IStreamSource, IStreamSubtitle } from '@/types/extraction-types';
import type { ProviderMediaObject } from '@omss/framework';

export class CineproAggregator {
  private providers = [
    new VidLinkProvider(),
    new VidNestProvider(),
    new VidApiProvider(),
    new VidSrcProvider(),
  ];

  async scrapeMovie(tmdbId: string): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const media: ProviderMediaObject = { type: 'movie', tmdbId } as any;
    return this.scrape(media);
  }

  async scrapeSeries(tmdbId: string, season: number, episode: number): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const media: ProviderMediaObject = { type: 'tv', tmdbId, s: season, e: episode } as any;
    return this.scrape(media);
  }

  private async scrape(media: ProviderMediaObject): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const promises = this.providers.map(async (provider) => {
      const result = media.type === 'movie' 
        ? await provider.getMovieSources(media) 
        : await provider.getTVSources(media);
        
      if (!result || !result.sources || result.sources.length === 0) {
        throw new Error(`No sources found by ${provider.name}`);
      }
      
      const mappedSources: IStreamSource[] = result.sources.map((s: any) => ({
        url: s.url,
        quality: this.mapQuality(s.quality),
        isM3U8: s.type === 'hls',
      }));

      const mappedSubtitles: IStreamSubtitle[] = (result.subtitles || []).map((s: any) => ({
        url: s.url,
        lang: s.label?.toLowerCase().substring(0, 2) || 'en',
        label: s.label || 'English',
        default: s.label?.toLowerCase() === 'english' || s.label?.toLowerCase() === 'en',
      }));

      return { sources: mappedSources, subtitles: mappedSubtitles };
    });

    return new Promise((resolve, reject) => {
      let failures = 0;
      let resolved = false;
      
      if (promises.length === 0) {
        return resolve({ sources: [], subtitles: [] });
      }

      promises.forEach(p => {
        p.then(res => {
          if (resolved) return;
          if (res.subtitles && res.subtitles.length > 0) {
            resolved = true;
            resolve(res);
          } else {
            // It has no subtitles. Wait 800ms for a better provider before settling.
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(res);
              }
            }, 800);
          }
        }).catch(() => {
          failures++;
          if (failures === promises.length && !resolved) {
            resolve({ sources: [], subtitles: [] });
          }
        });
      });
    });
  }

  private mapQuality(quality: string): string {
    if (!quality) return 'auto';
    const q = quality.toLowerCase();
    if (q.includes('4k') || q.includes('2160')) return 'auto'; // map 4k to auto for standard player
    if (q.includes('1080')) return '1080p';
    if (q.includes('720')) return '720p';
    if (q.includes('480')) return '480p';
    if (q.includes('360')) return '360p';
    return 'auto';
  }
}
