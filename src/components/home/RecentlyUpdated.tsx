'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Play, Loader2 } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { getRecentlyUpdatedAnime } from '@/lib/api/anilist';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import { useUserStore } from '@/store/userStore';

const getRealUploadTime = (rawMedia: any) => {
  // Option 1: Calculate time based on previous episode airing schedule (weekly)
  if (rawMedia?.nextAiringEpisode?.airingAt) {
    const nextEpTime = rawMedia.nextAiringEpisode.airingAt; // unix timestamp in seconds
    const lastEpTime = nextEpTime - (7 * 24 * 60 * 60); // 7 days ago
    const diffMs = Date.now() - (lastEpTime * 1000);
    if (diffMs > 0) {
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
    }
  }

  // Option 2: Fall back to DB updatedAt timestamp
  if (rawMedia?.updatedAt) {
    const diffMs = Date.now() - (rawMedia.updatedAt * 1000);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${Math.max(1, diffMins)}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  // Option 3: Balanced default fallback
  return '2h ago';
};

export default function RecentlyUpdated() {
  const { ref, inView } = useInView();
  const { settings } = useUserStore();
  const hideAdult = settings.hideAdult;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    queryKey: ['anime', 'recently-updated-infinite', hideAdult],
    queryFn: ({ pageParam = 1 }) => getRecentlyUpdatedAnime(20, pageParam, hideAdult),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.length > 0 ? allPages.length + 1 : undefined,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  const allItems = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

  if (status === 'pending') {
    return (
      <div className="px-4 md:px-6 py-6 flex flex-col gap-4">
        <div className="h-6 w-40 bg-surface skeleton rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video bg-surface skeleton rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'success' && allItems.length === 0) return null;

  return (
    <section className="px-4 md:px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-white font-display">Recently Updated</h2>
          <span className="text-[10px] text-accent-green font-bold uppercase tracking-widest border border-accent-green/30 px-1.5 py-0.5 rounded bg-accent-green/5 animate-pulse">Live</span>
        </div>
        <Link
          href="/season"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors group"
        >
          View Season <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {(() => {
          const seen = new Set();
          return allItems.map((rawMedia) => {
            const item = mapAniListToMediaItem(rawMedia);
            if (seen.has(item.id)) return null;
            seen.add(item.id);

            const title = item.title || 'Unknown Title';
            const posterUrl = item.posterUrl || '';
            const bannerUrl = item.bannerUrl || posterUrl;
            const latestEp = item.episodeCount || '?';
            const targetHref = `/${item.type}/${item.id}`;
            const watchHref = `/watch?id=${item.id}&type=${item.type}&ep=${item.episodeCount || 1}`;

            const uploadTime = getRealUploadTime(rawMedia);

            return (
              <div key={item.id} className="group flex flex-col">
                {/* Thumbnail (16:9) -> Player */}
                <Link href={watchHref} className="relative aspect-video rounded-lg overflow-hidden bg-surface mb-3 border border-border/50 group-hover:border-accent-green/50 transition-all shadow-lg">
                  {bannerUrl && (
                    <Image
                      src={bannerUrl}
                      alt={title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  )}
                  {/* Episode badge */}
                  <div className="absolute bottom-2 right-2 bg-black/90 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-md font-black border border-white/10 shadow-xl">
                    EP {latestEp}
                  </div>
                </Link>

                {/* Info row -> Details */}
                <div className="flex gap-3 items-start">
                  <Link href={targetHref} className="relative w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0 border border-white/5 group-hover:border-accent-green/30 transition-colors">
                    {posterUrl && (
                      <Image src={posterUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-white line-clamp-1 group-hover:text-accent-green transition-colors cursor-pointer">
                      <Link href={targetHref}>Episode {latestEp}</Link>
                    </p>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <Link href={targetHref} className="text-[12px] text-text-secondary line-clamp-1 flex-1 hover:text-white transition-colors">
                        {title}
                      </Link>
                      <span className="text-[10px] text-text-muted whitespace-nowrap font-medium italic">
                        {uploadTime}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Loading Sentinel */}
      <div ref={ref} className="py-12 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-3 text-accent-green bg-accent-green/5 border border-accent-green/20 px-4 py-2 rounded-full animate-pulse">
            <Loader2 className="animate-spin" size={18} />
            <span className="text-sm font-bold tracking-tight">Syncing more entries...</span>
          </div>
        )}
      </div>
    </section>
  );
}
