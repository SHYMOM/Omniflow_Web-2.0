'use client';

import { useState, useEffect } from 'react';
import { getPopularAnime } from '@/lib/api/anilist';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import type { MediaItem } from '@/types/media';
import MediaGrid from '@/components/media/MediaGrid';

export default function AnimeLandingPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getPopularAnime(24);
        setItems(res.map(mapAniListToMediaItem));
      } catch (err) {
        console.error('Failed to load anime landing', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <h1 className="text-2xl font-bold text-white mb-2 font-display">Anime Features</h1>
      <p className="text-xs text-text-secondary mb-6">Explore spectacular animated series spanning top-tier Japanese production studios</p>
      <MediaGrid items={items} loading={loading} skeletonCount={18} />
    </div>
  );
}
