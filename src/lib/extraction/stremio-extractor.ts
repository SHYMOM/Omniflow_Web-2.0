import { StealthHttpClient } from './stealth-client';
import { IStreamResult, IStreamSource } from '@/types/extraction-types';

export class StremioExtractor {
  private stealthClient: StealthHttpClient;
  private readonly addons = [
    // MediaFusion public
    'https://mediafusion.elfhosted.com',
    // Torrentio (with RD stripped if needed, or HTTP streams)
    'https://torrentio.strem.fun',
    // CinePro / Shluflix / KnightCrawler
    'https://knightcrawler.elfhosted.com',
    'https://shluflix.elfhosted.com'
  ];

  constructor() {
    this.stealthClient = new StealthHttpClient();
  }

  async extractDirectStream(
    tmdbId: string,
    mediaType: 'movie' | 'tv' | 'anime',
    episode?: number,
    season?: number,
    preResolvedImdbId?: string
  ): Promise<IStreamResult> {
    const imdbId = preResolvedImdbId || await this.getImdbId(tmdbId, mediaType);
    console.log("IMDB ID:", imdbId);
    if (!imdbId) {
      return this.emptyResult();
    }

    const sources: IStreamSource[] = [];
    
    const promises = this.addons.map(async (addon) => {
      const endpoint = mediaType === 'movie' 
        ? `${addon}/stream/movie/${imdbId}.json`
        : `${addon}/stream/series/${imdbId}:${season}:${episode}.json`;

      try {
        const res = await this.stealthClient.get(endpoint, { timeout: 4000 });
        if (res.data && res.data.streams) {
          res.data.streams.forEach((stream: any) => {
            // We only want direct HTTP streams, not torrent infoHashes or magnet links
            if (stream.url && (stream.url.includes('.m3u8') || stream.url.includes('.mp4'))) {
              sources.push({
                url: stream.url,
                quality: this.inferQuality(stream.name || stream.title),
                isM3U8: stream.url.includes('.m3u8'),
              });
            }
          });
        }
      } catch (e) {
        console.warn(`StremioExtractor: Failed to fetch from ${addon}`, (e as Error).message);
      }
    });

    await Promise.allSettled(promises);

    if (sources.length > 0) {
      return {
        success: true,
        provider: 'stremio-addons',
        sources,
        subtitles: [],
        headers: {}
      };
    }

    return this.emptyResult();
  }

  private inferQuality(title: string = ''): string {
    const t = title.toLowerCase();
    if (t.includes('4k') || t.includes('2160')) return 'auto';
    if (t.includes('1080')) return '1080p';
    if (t.includes('720')) return '720p';
    if (t.includes('480')) return '480p';
    if (t.includes('360')) return '360p';
    return 'auto';
  }

  private async getImdbId(tmdbId: string, type: 'movie' | 'tv' | 'anime'): Promise<string | null> {
    const TMDB_KEY = process.env.TMDB_API_KEY || '';
    if (!TMDB_KEY) return null;

    const fetchId = async (t: 'tv' | 'movie') => {
      try {
        const res = await this.stealthClient.get(
          `https://api.themoviedb.org/3/${t}/${tmdbId}/external_ids?api_key=${TMDB_KEY}`,
          { timeout: 3000 }
        );
        return res.data?.imdb_id || null;
      } catch {
        return null;
      }
    };

    if (type === 'anime') {
      const tvId = await fetchId('tv');
      if (tvId) return tvId;
      return fetchId('movie');
    }

    return fetchId(type);
  }

  private emptyResult(): IStreamResult {
    return {
      success: false,
      provider: 'stremio-addons',
      sources: [],
      subtitles: [],
      headers: {}
    };
  }
}
