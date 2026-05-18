'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getMovieDetails } from '@/lib/api/tmdb';
import { mapTMDBMovieToMediaItem } from '@/lib/api/hybrid';
import DetailHeader from '@/components/details/DetailHeader';
import OverviewTab from '@/components/details/OverviewTab';
import MoreLikeThisTab from '@/components/details/MoreLikeThisTab';
import Tabs from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const TABS = ['Overview', 'More Like This'];

export default function MovieDetailPage() {
  const params = useParams();
  const rawParamId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const idStr = String(rawParamId || '').replace('tmdb-movie-', '');
  const id = Number(idStr) || 0;
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const { data: movie, isLoading, error } = useQuery({
    queryKey: ['movie', id],
    queryFn: () => getMovieDetails(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size={40} /></div>;

  if (error || !movie) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Failed to load movie details.</p>
      </div>
    );
  }

  const mediaItem = mapTMDBMovieToMediaItem(movie);

  return (
    <div className="min-h-screen">
      <DetailHeader media={mediaItem} mediaType="movie" />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />
        
        <div className="mt-8">
          {activeTab === 'Overview' && <OverviewTab media={mediaItem} />}
          {activeTab === 'More Like This' && <MoreLikeThisTab media={mediaItem} />}
        </div>
      </div>
    </div>
  );
}
