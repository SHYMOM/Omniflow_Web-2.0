'use client';

import { useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import MediaCard from './MediaCard';
import SkeletonCard from './SkeletonCard';
import { cn } from '@/lib/utils/cn';

interface MediaRowProps {
  items: (AniListMedia | MediaItem)[];
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
  showHoverCard?: boolean;
  onLoadMore?: () => void;
}

export default function MediaRow({
  items,
  loading = false,
  skeletonCount = 8,
  className,
  showHoverCard = true,
  onLoadMore,
}: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const amount = container.clientWidth * 0.7;
    container.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });

    if (dir === 'right' && onLoadMore) {
      // Trigger loadMore if we are near the end of scroll
      const isNearEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - amount - 250;
      if (isNearEnd) {
        onLoadMore();
      }
    }
  };

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !onLoadMore) return;
    const container = scrollRef.current;
    const isNearEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 250;
    if (isNearEnd) {
      onLoadMore();
    }
  }, [onLoadMore]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="w-[150px] shrink-0">
            <SkeletonCard />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('relative group/row', className)}>
      {/* Scroll left button */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface/90 border border-border flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-surface-hover cursor-pointer"
        aria-label="Scroll left"
      >
        <ChevronLeft size={20} />
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-3 overflow-x-auto hide-scrollbar scroll-smooth pb-2"
      >
        {(() => {
          const seen = new Set();
          return items.map((media) => {
            const id = typeof media.id === 'string' ? media.id : `anilist-${media.id}`;
            if (seen.has(id)) return null;
            seen.add(id);
            return (
              <div key={id} className="w-[150px] shrink-0">
                <MediaCard media={media} showHoverCard={showHoverCard} />
              </div>
            );
          });
        })()}
      </div>

      {/* Scroll right button */}
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/3 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-surface/90 border border-border flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-opacity hover:bg-surface-hover cursor-pointer"
        aria-label="Scroll right"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
