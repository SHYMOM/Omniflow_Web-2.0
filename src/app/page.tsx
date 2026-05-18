'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getTopUpcomingAnime } from '@/lib/api/anilist';
import { getHybridTrending } from '@/lib/api/hybrid';
import { useUserStore } from '@/store/userStore';
import HeroBanner from '@/components/home/HeroBanner';
import ContinueWatching from '@/components/home/ContinueWatching';
import TrendingRow from '@/components/home/TrendingRow';
import TabbedGrid from '@/components/home/TabbedGrid';
import RecentComments from '@/components/home/RecentComments';
import ScheduleWidget from '@/components/home/ScheduleWidget';
import TopUpcoming from '@/components/home/TopUpcoming';
import RecentlyUpdated from '@/components/home/RecentlyUpdated';

export default function HomePage() {
  const { settings } = useUserStore();
  const hideAdult = settings.hideAdult;

  // Infinite Query for Trending Now
  const {
    data: trendingPages,
    isLoading: trendingLoading,
    fetchNextPage: fetchNextTrending,
    hasNextPage: hasNextTrending
  } = useInfiniteQuery({
    queryKey: ['hybrid', 'trending-infinite', hideAdult],
    queryFn: ({ pageParam = 1 }) => getHybridTrending(pageParam, hideAdult),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.length > 0 ? allPages.length + 1 : undefined,
  });

  // Infinite Query for Top Upcoming
  const {
    data: upcomingPages,
    fetchNextPage: fetchNextUpcoming,
    hasNextPage: hasNextUpcoming
  } = useInfiniteQuery({
    queryKey: ['anime', 'upcoming-infinite', hideAdult],
    queryFn: ({ pageParam = 1 }) => getTopUpcomingAnime(12, pageParam, hideAdult),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.length > 0 ? allPages.length + 1 : undefined,
  });

  const trendingItems = trendingPages?.pages.flat() || [];
  const upcomingItems = upcomingPages?.pages.flat() || [];

  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <HeroBanner items={trendingItems} />

      {/* Continue Watching */}
      <ContinueWatching />

      {/* Trending Row */}
      <TrendingRow 
        items={trendingItems} 
        loading={trendingLoading} 
        onLoadMore={() => hasNextTrending && fetchNextTrending()} 
      />

      {/* Main content area with sidebar */}
      <div className="px-4 md:px-6">
        <div className="flex gap-6">
          {/* Left: Tabbed Grid */}
          <div className="flex-1 min-w-0">
            <TabbedGrid />
          </div>

          {/* Right: Sidebar widgets (desktop only) */}
          <div className="hidden xl:flex flex-col gap-4 w-[380px] shrink-0">
            <RecentComments />
            <ScheduleWidget />
          </div>
        </div>
      </div>

      {/* Top Upcoming */}
      <TopUpcoming 
        items={upcomingItems} 
        onLoadMore={() => hasNextUpcoming && fetchNextUpcoming()} 
      />

      {/* Recently Updated */}
      <RecentlyUpdated />
    </div>
  );
}
