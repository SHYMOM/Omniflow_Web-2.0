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

  async scrapeMovie(tmdbId: string, imdbId?: string): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const media: ProviderMediaObject = { type: 'movie', tmdbId, imdbId } as any;
    return this.scrape(media);
  }

  async scrapeSeries(tmdbId: string, season: number, episode: number, imdbId?: string): Promise<{ sources: IStreamSource[], subtitles: IStreamSubtitle[] }> {
    const media: ProviderMediaObject = { type: 'tv', tmdbId, s: season, e: episode, imdbId } as any;
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
      
      const mappedSources: IStreamSource[] = result.sources.map((s: any) => {
        let referer = s.headers?.Referer || s.headers?.referer || '';
        if (!referer && s.provider?.id === 'vidsrc') referer = 'https://cloudnestra.com/';
        if (!referer && s.provider?.id === 'vidnest') referer = 'https://vidnest.fun/';
        if (!referer && s.provider?.id === 'vidapi') referer = 'https://brightpathsignals.com/';
        if (!referer && s.provider?.id === 'vidlink') referer = 'https://vidlink.pro/';
        
        return {
          url: s.url,
          quality: this.mapQuality(s.quality),
          isM3U8: s.type === 'hls',
          referer,
          provider: s.provider
        };
      });

      const mappedSubtitles: IStreamSubtitle[] = (result.subtitles || []).map((s: any) => ({
        url: s.url,
        lang: s.label?.toLowerCase().substring(0, 2) || 'en',
        label: s.label || 'English',
        default: s.label?.toLowerCase() === 'english' || s.label?.toLowerCase() === 'en',
      }));

      return { sources: mappedSources, subtitles: mappedSubtitles };
    });


    return new Promise((resolve) => {
      let completions = 0;
      let resolved = false;
      const total = promises.length;
      
      if (total === 0) {
        return resolve({ sources: [], subtitles: [] });
      }

      const onDone = () => {
        completions++;
        if (completions === total && !resolved) {
          resolved = true;
          resolve({ sources: [], subtitles: [] });
        }
      };

      promises.forEach(p => {
        p.then(res => {
          if (resolved) { onDone(); return; }
          if (res.sources && res.sources.length > 0 && res.subtitles && res.subtitles.length > 0) {
            // Best case: has both sources AND subtitles — resolve immediately
            resolved = true;
            resolve(res);
            completions++;
          } else if (res.sources && res.sources.length > 0) {
            // Has sources but no subtitles. Wait 800ms for a richer provider.
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(res);
              }
            }, 800);
            onDone();
          } else {
            // Empty result — count as done
            onDone();
          }
        }).catch(() => {
          onDone();
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
