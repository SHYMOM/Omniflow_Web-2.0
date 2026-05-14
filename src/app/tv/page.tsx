'use client';

import { useState, useEffect } from 'react';
import { getTrendingTV } from '@/lib/api/tmdb';
import { mapTMDBTVToMediaItem } from '@/lib/api/hybrid';
import type { MediaItem } from '@/types/media';
import MediaGrid from '@/components/media/MediaGrid';

export default function TVLandingPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getTrendingTV('week');
        setItems(res.map(mapTMDBTVToMediaItem));
      } catch (err) {
        console.error('Failed to load tv landing', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <h1 className="text-2xl font-bold text-white mb-2 font-display">TV Series Streams</h1>
      <p className="text-xs text-text-secondary mb-6">Explore seasonal television broadcast lineups and premium episodic multi-season streams</p>
      <MediaGrid items={items} loading={loading} skeletonCount={18} />
    </div>
  );
}
