'use client';

import { useQuery } from '@tanstack/react-query';
import { getUpcomingAnime, getRecentlyUpdatedAnime } from '@/lib/api/anilist';
import { getHybridTrending } from '@/lib/api/hybrid';
import HeroBanner from '@/components/home/HeroBanner';
import ContinueWatching from '@/components/home/ContinueWatching';
import TrendingRow from '@/components/home/TrendingRow';
import TabbedGrid from '@/components/home/TabbedGrid';
import RecentComments from '@/components/home/RecentComments';
import ScheduleWidget from '@/components/home/ScheduleWidget';
import TopUpcoming from '@/components/home/TopUpcoming';
import RecentlyUpdated from '@/components/home/RecentlyUpdated';

export default function HomePage() {
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ['hybrid', 'trending'],
    queryFn: () => getHybridTrending(),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['anime', 'upcoming'],
    queryFn: () => getUpcomingAnime(6),
  });

  const { data: recentData } = useQuery({
    queryKey: ['anime', 'recently-updated'],
    queryFn: () => getRecentlyUpdatedAnime(20),
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
      <RecentlyUpdated items={recentData || []} />
    </div>
  );
}
