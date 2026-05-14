'use client';

import { useState, useEffect } from 'react';
import { searchAniList } from '@/lib/api/anilist';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import type { MediaItem } from '@/types/media';
import MediaGrid from '@/components/media/MediaGrid';

export default function MangaLandingPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await searchAniList('', 'MANGA', 24);
        setItems(res.media.map(mapAniListToMediaItem));
      } catch (err) {
        console.error('Failed to load manga landing', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <h1 className="text-2xl font-bold text-white mb-2 font-display">Manga & Light Novels</h1>
      <p className="text-xs text-text-secondary mb-6">Read digital manga volumes, ongoing serializations, and highly acclaimed illustrated publications</p>
      <MediaGrid items={items} loading={loading} skeletonCount={18} />
    </div>
  );
}
