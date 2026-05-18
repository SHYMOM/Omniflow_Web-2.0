'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, TrendingUp, Flame, Star } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import MediaGrid from '@/components/media/MediaGrid';
import { getThisSeasonAnime, getPopularAnime, getTopRatedAnime } from '@/lib/api/anilist';
import { useUserStore } from '@/store/userStore';

const TAB_LIST = ['This Season', 'All Time Popular', 'Top Rated'];

const TAB_ICONS: Record<string, React.ReactNode> = {
  'This Season': <TrendingUp size={16} />,
  'All Time Popular': <Flame size={16} />,
  'Top Rated': <Star size={16} />,
};

export default function TabbedGrid() {
  const [activeTab, setActiveTab] = useState(TAB_LIST[0]);

  const { settings } = useUserStore();
  const hideAdult = settings.hideAdult;

  // Single dynamic query key and function: automatically refetches on activeTab change,
  // completely eliminating parallel Jikan hits on mount and ensuring 100% refresh reliability!
  const { data: currentData, isLoading: currentLoading } = useQuery({
    queryKey: ['anime', 'tabbed-grid', activeTab, hideAdult],
    queryFn: async () => {
      if (activeTab === TAB_LIST[0]) {
        return getThisSeasonAnime(40, 1, hideAdult);
      } else if (activeTab === TAB_LIST[1]) {
        return getPopularAnime(40, 1, hideAdult);
      } else {
        return getTopRatedAnime(40, 1, hideAdult);
      }
    },
    // Retains previous grid content during active fetches for an exceptionally smooth transition
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000, // 30 seconds fresh cache
    refetchOnWindowFocus: false,
  });

  const targetHref = activeTab === TAB_LIST[0] ? '/season'
    : activeTab === TAB_LIST[1] ? '/popular'
    : '/top-rated';

  return (
    <section className="py-6">
      <Tabs 
        tabs={TAB_LIST} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        variant="pills"
        icons={TAB_ICONS}
        className="mb-6" 
      />

      <MediaGrid
        items={currentData || []}
        loading={currentLoading}
        skeletonCount={40}
      />

      <Link
        href={targetHref}
        className="block mt-4 py-3 text-center text-sm text-text-secondary bg-surface hover:bg-surface-hover border border-border rounded-lg transition-colors font-bold"
      >
        View more <ArrowRight size={14} className="inline ml-1" />
      </Link>
    </section>
  );
}
