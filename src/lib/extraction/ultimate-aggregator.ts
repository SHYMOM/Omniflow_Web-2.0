import type { IStreamResult, IStreamSubtitle, IStreamSource } from '@/types/extraction-types';
import { makeProviders, makeStandardFetcher, targets } from '@movie-web/providers';

export class UltimateAggregator {
  private providers;

  constructor() {
    // Initialize movie-web providers with a standard fetcher
    const fetcher = makeStandardFetcher(fetch);
    this.providers = makeProviders({
      fetcher,
      target: targets.ANY,
    });
  }

  async extractDirectStreams(
    mediaId: string,
    mediaType: 'movie' | 'tv' | 'anime',
    episode: number,
    season: number,
    isDub?: boolean,
    title: string = 'Unknown',
    releaseYear: number = new Date().getFullYear(),
    seasonTmdbId: string = '',
    episodeTmdbId: string = ''
  ): Promise<IStreamResult> {
    try {
      // 1. Map request into movie-web media format
      const media: any = {
        type: mediaType === 'movie' ? 'movie' : 'show',
        title: title,
        releaseYear: releaseYear,
        tmdbId: mediaId,
      };

      if (mediaType === 'tv' || mediaType === 'anime') {
        media.season = { number: season, tmdbId: seasonTmdbId };
        media.episode = { number: episode, tmdbId: episodeTmdbId };
      }

      // 2. Execute parallel extraction across dozens of providers natively
      const result = await this.providers.runAll({
        media: media,
      });

      // 3. Map movie-web output strictly into our internal format
      if (result && result.stream) {
        const sources: IStreamSource[] = [];
        const subtitles: IStreamSubtitle[] = [];

        if (result.stream.type === 'hls') {
          sources.push({ url: result.stream.playlist, quality: 'auto', isM3U8: true });
        } else if (result.stream.type === 'file') {
          const qualities = result.stream.qualities;
          if (qualities) {
            for (const q of Object.keys(qualities)) {
              // @ts-ignore
              sources.push({ url: qualities[q].url, quality: q, isM3U8: false });
            }
          }
        }

        if (result.stream.captions) {
          result.stream.captions.forEach((cap: any) => {
            const labelStr = cap.language || cap.type || 'Subtitle';
            const langCode = (cap.language || 'en').toLowerCase().substring(0, 2);
            
            subtitles.push({
              url: cap.url,
              lang: langCode,
              label: labelStr.charAt(0).toUpperCase() + labelStr.slice(1),
              default: langCode === 'en' || cap.language?.toLowerCase() === 'english',
            });
          });
        }

        return {
          success: sources.length > 0,
          provider: `ultimate-${result.sourceId}`,
          sources,
          subtitles,
          headers: (result.stream as any).headers || {},
        };
      }
    } catch (e) {
      console.warn(`[UltimateAggregator] Movie-Web extraction failed for ${mediaId}:`, e);
    }

    return {
      success: false,
      provider: 'ultimate-aggregator',
      sources: [],
      subtitles: [],
      headers: {},
    };
  }
}
