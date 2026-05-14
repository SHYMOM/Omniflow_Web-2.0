'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getAnimeDetail, getAnimeByMalId } from '@/lib/api/anilist';
import { extractId, mapAniListToMediaItem } from '@/lib/api/hybrid';
import DetailHeader from '@/components/details/DetailHeader';
import OverviewTab from '@/components/details/OverviewTab';
import EpisodesTab from '@/components/details/EpisodesTab';
import RelatedTab from '@/components/details/RelatedTab';
import MoreLikeThisTab from '@/components/details/MoreLikeThisTab';
import Tabs from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const TABS = ['Overview', 'Episodes', 'Related', 'More Like This'];

export default function AnimeDetailPage() {
  const params = useParams();
  const rawId = params.id as string;
  const id = extractId(rawId);
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const { data: media, isLoading, error } = useQuery({
    queryKey: ['anime', rawId], // Use rawId for cache key
    queryFn: () => {
      if (rawId.startsWith('mal-')) {
        return getAnimeByMalId(id);
      }
      return getAnimeDetail(id);
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Failed to load anime details.</p>
      </div>
    );
  }

  const mediaItem = mapAniListToMediaItem(media);

  return (
    <div>
      <DetailHeader media={mediaItem} mediaType="anime" />

      <div className="px-4 md:px-6 max-w-7xl mx-auto">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

        {activeTab === 'Overview' && <OverviewTab media={mediaItem} />}
        {activeTab === 'Episodes' && <EpisodesTab media={media} />}
        {activeTab === 'Related' && <RelatedTab media={media} />}
        {activeTab === 'More Like This' && <MoreLikeThisTab media={media} />}
      </div>
    </div>
  );
}
