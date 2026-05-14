'use client';

import { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { getThisSeasonAnime } from '@/lib/api/anilist';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import MediaGrid from '@/components/media/MediaGrid';
import { Loader2 } from 'lucide-react';

export default function SeasonPage() {
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    queryKey: ['anime', 'this-season'],
    queryFn: ({ pageParam = 1 }) => getThisSeasonAnime(24, pageParam).then(res => res.map(mapAniListToMediaItem)),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.length === 24 ? allPages.length + 1 : undefined,
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
      <h1 className="text-2xl font-bold text-white mb-2 font-display">Current Season Streams</h1>
      <p className="text-xs text-text-secondary mb-6">Explore the latest broadcasting titles airing this current calendar season</p>
      
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
