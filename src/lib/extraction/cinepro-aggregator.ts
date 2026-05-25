import { VidNestProvider } from './cinepro-providers/vidnest/vidnest';
import { VidSrcProvider } from './cinepro-providers/vidsrc/vidsrc';
import { VidApiProvider } from './cinepro-providers/vidapi/vidapi';
import { IStreamSource, IStreamSubtitle } from '@/types/extraction-types';
import type { ProviderMediaObject } from '@omss/framework';

export class CineproAggregator {
  private providers = [
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
    const allSources: IStreamSource[] = [];
    const allSubtitles: IStreamSubtitle[] = [];

    const promises = this.providers.map(async (provider) => {
      try {
        const result = media.type === 'movie' 
          ? await provider.getMovieSources(media) 
          : await provider.getTVSources(media);
          
        if (result && result.sources) {
          result.sources.forEach((s) => {
            allSources.push({
              url: s.url,
              quality: this.mapQuality(s.quality),
              isM3U8: s.type === 'hls',
            });
          });
        }
        if (result && result.subtitles) {
          result.subtitles.forEach((s) => {
            allSubtitles.push({
              url: s.url,
              lang: s.label?.toLowerCase().substring(0, 2) || 'en',
              label: s.label || 'English',
              default: s.label?.toLowerCase() === 'english' || s.label?.toLowerCase() === 'en',
            });
          });
        }
      } catch (e) {
        console.warn(`CineproAggregator: Error in ${provider.name}`, (e as Error).message);
      }
    });

    await Promise.allSettled(promises);
    return { sources: allSources, subtitles: allSubtitles };
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
