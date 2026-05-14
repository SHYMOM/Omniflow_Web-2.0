'use client';

import { useState, useEffect } from 'react';
import { getTrendingMovies } from '@/lib/api/tmdb';
import { mapTMDBMovieToMediaItem } from '@/lib/api/hybrid';
import type { MediaItem } from '@/types/media';
import MediaGrid from '@/components/media/MediaGrid';

export default function MoviesLandingPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getTrendingMovies('week');
        setItems(res.map(mapTMDBMovieToMediaItem));
      } catch (err) {
        console.error('Failed to load movies landing', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <h1 className="text-2xl font-bold text-white mb-2 font-display">Cinematic Movies</h1>
      <p className="text-xs text-text-secondary mb-6">Discover high-definition feature-length theatrical movie releases streaming globally</p>
      <MediaGrid items={items} loading={loading} skeletonCount={18} />
    </div>
  );
}
