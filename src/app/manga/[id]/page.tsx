'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getMangaDetail } from '@/lib/api/anilist';
import { extractId } from '@/lib/api/hybrid';
import DetailHeader from '@/components/details/DetailHeader';
import OverviewTab from '@/components/details/OverviewTab';
import RelatedTab from '@/components/details/RelatedTab';
import Tabs from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const TABS = ['Overview', 'Chapters', 'Related'];

export default function MangaDetailPage() {
  const params = useParams();
  const id = extractId(params.id as string);
  const [activeTab, setActiveTab] = useState(TABS[0]);

  const { data: media, isLoading, error } = useQuery({
    queryKey: ['manga', id],
    queryFn: () => getMangaDetail(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size={40} /></div>;

  if (error || !media) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Failed to load manga details.</p>
      </div>
    );
  }

  return (
    <div>
      <DetailHeader media={media} mediaType="manga" />

      <div className="px-4 md:px-6 max-w-7xl mx-auto">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

        {activeTab === 'Overview' && <OverviewTab media={media} />}
        {activeTab === 'Chapters' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
             {Array.from({ length: media.chapters || 20 }).map((_, i) => (
               <a 
                 key={i} 
                 href={`/read/${id}/${i + 1}`}
                 className="p-3 bg-surface border border-border rounded-lg hover:border-accent-green/50 transition-colors text-sm font-medium"
               >
                 Chapter {i + 1}
               </a>
             ))}
          </div>
        )}
        {activeTab === 'Related' && <RelatedTab media={media} />}
      </div>
    </div>
  );
}
