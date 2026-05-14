'use client';

import { useQuery } from '@tanstack/react-query';
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

  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['hybrid', 'trending', hideAdult],
    queryFn: () => getHybridTrending(hideAdult),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['anime', 'upcoming', hideAdult],
    queryFn: () => getTopUpcomingAnime(6, 1, hideAdult),
  });


  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <HeroBanner items={trendingData || []} />

      {/* Continue Watching */}
      <ContinueWatching />

      {/* Trending Row */}
      <TrendingRow items={trendingData || []} loading={trendingLoading} />

      {/* Main content area with sidebar */}
      <div className="px-4 md:px-6">
        <div className="flex gap-6">
          {/* Left: Tabbed Grid */}
          <div className="flex-1 min-w-0">
            <TabbedGrid />
          </div>

          {/* Right: Sidebar widgets (desktop only) */}
          <div className="hidden xl:flex flex-col gap-4 w-[300px] shrink-0">
            <RecentComments />
            <ScheduleWidget />
          </div>
        </div>
      </div>

      {/* Top Upcoming */}
      <TopUpcoming items={upcomingData || []} />

      {/* Recently Updated */}
      <RecentlyUpdated />
    </div>
  );
}
