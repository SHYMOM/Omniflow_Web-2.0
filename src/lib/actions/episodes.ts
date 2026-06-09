'use server';

import { getMediaEpisodes } from '@/lib/api/hybrid';

export async function fetchMediaEpisodesAction(id: string, type: string, season: number = 1) {
  return await getMediaEpisodes(id, type, season);
}
