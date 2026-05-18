'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getTVDetails } from '@/lib/api/tmdb';
import { mapTMDBTVToMediaItem } from '@/lib/api/hybrid';
import DetailHeader from '@/components/details/DetailHeader';
import OverviewTab from '@/components/details/OverviewTab';
import MoreLikeThisTab from '@/components/details/MoreLikeThisTab';
import Tabs from '@/components/ui/Tabs';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TVSeasonView from '@/components/details/TVSeasonView';

const TABS = ['Overview', 'Seasons', 'More Like This'];

export default function TVDetailPage() {
  const params = useParams();
  const rawParamId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const idStr = String(rawParamId || '').replace('tmdb-tv-', '');
  const id = Number(idStr) || 0;
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

  const { data: tv, isLoading, error } = useQuery({
    queryKey: ['tv', id],
    queryFn: () => getTVDetails(id),
    enabled: !!id,
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size={40} /></div>;

  if (error || !tv) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Failed to load TV show details.</p>
      </div>
    );
  }

  const mediaItem = mapTMDBTVToMediaItem(tv);

  return (
    <div className="min-h-screen">
      <DetailHeader media={mediaItem} mediaType="tv" />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 pb-20">
        <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />
        
        <div className="mt-8">
          {activeTab === 'Overview' && <OverviewTab media={mediaItem} />}
          
          {activeTab === 'Seasons' && (
            <div>
              {selectedSeason !== null ? (
                <div>
                  <button 
                    onClick={() => setSelectedSeason(null)}
                    className="mb-6 text-sm text-accent-green hover:underline flex items-center gap-1"
                  >
                    ← Back to Seasons
                  </button>
                  <TVSeasonView tvId={id} seasonNumber={selectedSeason} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tv.seasons?.map(season => (
                    <div 
                      key={season.id} 
                      onClick={() => setSelectedSeason(season.season_number)}
                      className="flex gap-4 p-3 bg-surface border border-border rounded-xl hover:border-accent-green/50 cursor-pointer transition-all hover:bg-surface-hover group"
                    >
                      <div className="relative w-20 h-28 rounded-lg overflow-hidden bg-void shrink-0 shadow-lg">
                        {season.poster_path ? (
                          <img 
                            src={`https://image.tmdb.org/t/p/w200${season.poster_path}`} 
                            alt={season.name} 
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">No Poster</div>
                        )}
                      </div>
                      <div className="flex-1 py-1">
                        <h4 className="text-sm font-bold text-white group-hover:text-accent-green transition-colors">{season.name}</h4>
                        <p className="text-xs text-accent-green font-medium mt-1">{season.episode_count} Episodes</p>
                        {season.air_date && <p className="text-[10px] text-text-muted mt-1">{new Date(season.air_date).getFullYear()}</p>}
                        <p className="text-[10px] text-text-secondary mt-2 line-clamp-2 leading-relaxed">{season.overview || "No overview available for this season."}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'More Like This' && <MoreLikeThisTab media={mediaItem} />}
        </div>
      </div>
    </div>
  );
}
