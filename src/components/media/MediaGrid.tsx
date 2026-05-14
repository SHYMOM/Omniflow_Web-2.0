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
  columns = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  className,
  showHoverCard = true,
}: MediaGridProps) {
  if (loading) {
    return (
      <div className={cn('grid gap-3', columns, className)}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3', columns, className)}>
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
