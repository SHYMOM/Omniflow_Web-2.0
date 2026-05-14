'use client';

import { useState, useEffect } from 'react';
import { getTrendingMovies } from '@/lib/api/tmdb';
import { mapTMDBMovieToMediaItem } from '@/lib/api/hybrid';
import type { MediaItem } from '@/types/media';
import MediaGrid from '@/components/media/MediaGrid';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function MoviesLandingPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  async function loadMore() {
    if (loading && items.length > 0) return;
    setLoading(true);
    try {
      const res = await getTrendingMovies('week', page);
      const newItems = res.map(mapTMDBMovieToMediaItem);
      if (newItems.length < 20) setHasMore(false);
      setItems(prev => [...prev, ...newItems]);
      setPage(prev => prev + 1);
    } catch (err) {
      console.error('Failed to load movies landing', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2 font-display">Cinematic Movies</h1>
        <p className="text-xs text-text-secondary">Discover high-definition feature-length theatrical movie releases streaming globally</p>
      </div>
      
      <MediaGrid items={items} loading={loading && items.length === 0} skeletonCount={18} />
      
      {hasMore && (
        <div className="mt-12 flex justify-center">
          <button 
            onClick={loadMore}
            disabled={loading}
            className="bg-surface hover:bg-surface-hover border border-border px-8 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <LoadingSpinner size={16} />}
            {loading ? 'Fetching More...' : 'Load More Content'}
          </button>
        </div>
      )}
    </div>
  );
}
