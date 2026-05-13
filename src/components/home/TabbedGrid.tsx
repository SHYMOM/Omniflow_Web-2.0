'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Tabs from '@/components/ui/Tabs';
import MediaGrid from '@/components/media/MediaGrid';
import { getThisSeasonAnime, getPopularAnime, getTopRatedAnime } from '@/lib/api/anilist';

const TAB_LIST = ['This Season', 'All Time Popular', 'Top Rated'];

export default function TabbedGrid() {
  const [activeTab, setActiveTab] = useState(TAB_LIST[0]);

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: ['anime', 'this-season'],
    queryFn: () => getThisSeasonAnime(18),
  });

  const { data: popularData, isLoading: popularLoading } = useQuery({
    queryKey: ['anime', 'popular'],
    queryFn: () => getPopularAnime(18),
  });

  const { data: topRatedData, isLoading: topRatedLoading } = useQuery({
    queryKey: ['anime', 'top-rated'],
    queryFn: () => getTopRatedAnime(18),
  });

  const currentData = activeTab === TAB_LIST[0] ? seasonData
    : activeTab === TAB_LIST[1] ? popularData
    : topRatedData;

  const currentLoading = activeTab === TAB_LIST[0] ? seasonLoading
    : activeTab === TAB_LIST[1] ? popularLoading
    : topRatedLoading;

  const sortParam = activeTab === TAB_LIST[0] ? 'this-season'
    : activeTab === TAB_LIST[1] ? 'popular'
    : 'top-rated';

  return (
    <section className="py-6">
      <Tabs tabs={TAB_LIST} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

      <MediaGrid
        items={currentData || []}
        loading={currentLoading}
        skeletonCount={18}
        columns="grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
      />

      <Link
        href={`/search?sort=${sortParam}`}
        className="block mt-4 py-3 text-center text-sm text-text-secondary bg-surface hover:bg-surface-hover border border-border rounded-lg transition-colors"
      >
        View more <ArrowRight size={14} className="inline ml-1" />
      </Link>
    </section>
  );
}
