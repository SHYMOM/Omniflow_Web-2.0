'use client';

import type { AniListMedia } from '@/types/anilist';
import MediaCard from './MediaCard';
import SkeletonCard from './SkeletonCard';
import { cn } from '@/lib/utils/cn';

interface MediaGridProps {
  items: AniListMedia[];
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
  columns = 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
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
      {items.map((media) => (
        <MediaCard key={media.id} media={media} showHoverCard={showHoverCard} />
      ))}
    </div>
  );
}
