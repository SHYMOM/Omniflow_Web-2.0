// src/lib/extraction/aniskip.service.ts
import { SkipTime } from '@/types/extraction-types';

export class AniSkipService {
  /**
   * Fetches skip times (op/ed) for a given MAL ID and episode number using the AniSkip API.
   */
  static async fetchSkipTimes(malId: number, episode: number): Promise<SkipTime | null> {
    if (!malId || !episode) return null;

    try {
      const url = `https://api.aniskip.com/v2/skip-times/${malId}/${episode}?types[]=op&types[]=ed&episodeLength=0`;
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        next: { revalidate: 86400 } // Cache for 24 hours
      });

      if (!res.ok) {
        if (res.status !== 404) {
           console.warn(`[AniSkip] API returned ${res.status} for ${malId} ep ${episode}`);
        }
        return null;
      }

      const data = await res.json();
      if (!data.found || !data.results) return null;

      const skipData: SkipTime = { introStart: 0, introEnd: 0 };
      let hasValidData = false;

      for (const result of data.results) {
        if (result.skipType === 'op' && result.interval) {
          skipData.introStart = result.interval.startTime;
          skipData.introEnd = result.interval.endTime;
          hasValidData = true;
        } else if (result.skipType === 'ed' && result.interval) {
          skipData.outroStart = result.interval.startTime;
          skipData.outroEnd = result.interval.endTime;
          hasValidData = true;
        }
      }

      return hasValidData ? skipData : null;
    } catch (err) {
      console.warn('[AniSkip] Error fetching skip times:', err);
      return null;
    }
  }
}
