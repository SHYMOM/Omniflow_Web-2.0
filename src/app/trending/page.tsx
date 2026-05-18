'use client';

import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { getHybridTrending } from '@/lib/api/hybrid';
import MediaGrid from '@/components/media/MediaGrid';
import { Loader2 } from 'lucide-react';
import { useUserStore } from '@/store/userStore';

export default function TrendingPage() {
  const { ref, inView } = useInView();
  const { settings } = useUserStore();
  const hideAdult = settings?.hideAdult ?? true;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    queryKey: ['trending', hideAdult],
    queryFn: () => getHybridTrending(hideAdult),
    initialPageParam: 1,
    getNextPageParam: () => undefined,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  const allItems = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <h1 className="text-2xl font-bold text-white mb-2 font-display">Trending Now</h1>
      <p className="text-xs text-text-secondary mb-6">Top performing cinematic media streams active globally</p>
      
      <MediaGrid items={allItems} loading={status === 'pending'} skeletonCount={18} />

      <div ref={ref} className="py-8 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-accent-green animate-pulse">
            <Loader2 className="animate-spin" />
            <span className="text-sm font-medium">Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
}
