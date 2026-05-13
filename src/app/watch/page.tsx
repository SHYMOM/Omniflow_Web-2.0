'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getAnimeDetail } from '@/lib/api/anilist';
import { usePlayerStore } from '@/store/playerStore';
import VideoPlayer from '@/components/player/VideoPlayer';
import ServerSwitcher from '@/components/player/ServerSwitcher';
import EpisodeSidebar from '@/components/player/EpisodeSidebar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function WatchContent() {
  const searchParams = useSearchParams();
  const mediaId = Number(searchParams.get('id'));
  const mediaType = searchParams.get('type') || 'anime';
  const epNum = Number(searchParams.get('ep') || '1');

  const { activeServerId } = usePlayerStore();

  const { data: media, isLoading } = useQuery({
    queryKey: ['anime', mediaId],
    queryFn: () => getAnimeDetail(mediaId),
    enabled: !!mediaId && mediaType === 'anime',
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size={40} /></div>;

  const title = media?.title.english || media?.title.romaji || '';
  const malId = media?.idMal;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: Player + info */}
        <div className="flex-1 min-w-0">
          <VideoPlayer malId={malId || 0} tmdbId={0} mediaType={mediaType} episode={epNum} season={1} serverId={activeServerId} />
          <div className="mt-3">
            <p className="text-sm text-text-secondary">⚠️ If current server doesn&apos;t work, try switching servers below.</p>
          </div>
          <div className="mt-3">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-sm text-text-secondary">Episode {epNum}</p>
          </div>
          <ServerSwitcher mediaType={mediaType} />
        </div>

        {/* Right: Episode sidebar */}
        <div className="lg:w-[350px] shrink-0">
          <EpisodeSidebar mediaId={mediaId} mediaType={mediaType} currentEp={epNum} malId={malId || 0} totalEpisodes={media?.episodes || 0} title={title} />
        </div>
      </div>
    </div>
  );
}

export default function WatchPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size={40} /></div>}><WatchContent /></Suspense>;
}
