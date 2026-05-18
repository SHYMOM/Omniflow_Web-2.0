'use client';

import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import MediaCard from './MediaCard';
import SkeletonCard from './SkeletonCard';
import { cn } from '@/lib/utils/cn';

interface MediaGridProps {
  items: (AniListMedia | MediaItem)[];
  loading?: boolean;
  skeletonCount?: number;
  columns?: string;
  className?: string;
  showHoverCard?: boolean;
}

export default function MediaGrid({
  items,
  loading = false,
  skeletonCount = 12,
  columns = 'grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]',
  className,
  showHoverCard = true,
}: MediaGridProps) {
  if (loading) {
    return (
      <div className={cn('grid gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6', columns, className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6', columns, className)}>
      {(() => {
        const seen = new Set();
        return items.map((media) => {
          const id = typeof media.id === 'string' ? media.id : `anilist-${media.id}`;
          if (seen.has(id)) return null;
          seen.add(id);
          return <MediaCard key={id} media={media} showHoverCard={showHoverCard} />;
        });
      })()}
    </div>
  );
}
