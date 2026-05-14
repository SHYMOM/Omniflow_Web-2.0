'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import HoverCard from './HoverCard';

interface MediaCardProps {
  media: MediaItem | AniListMedia;
  className?: string;
  showHoverCard?: boolean;
}

export default function MediaCard({ media, className, showHoverCard = true }: MediaCardProps) {
  const [showPopover, setShowPopover] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Adapt input media seamlessly to unified MediaItem schema
  const item: MediaItem = typeof media.id === 'string' ? media as MediaItem : mapAniListToMediaItem(media as AniListMedia);

  const title = item.title || 'Unknown Title';
  const posterUrl = item.posterUrl || item.bannerUrl || '';
  const scoreDisplay = item.score ? (item.source === 'anilist' ? `${Math.round(item.score * 10)}%` : `${item.score}`) : null;
  const isAiring = item.status === 'RELEASING';
  const formatLabel = item.formatLabel || 'TV Show';
  const year = item.year || '';

  const href = item.type === 'manga'
    ? `/manga/${item.id}`
    : item.type === 'movie'
    ? `/movies/${item.id}`
    : item.type === 'tv'
    ? `/tv/${item.id}`
    : `/anime/${item.id}`;

  const handleMouseEnter = useCallback(() => {
    if (!showHoverCard) return;
    timeoutRef.current = setTimeout(() => setShowPopover(true), 350);
  }, [showHoverCard]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowPopover(false);
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn('relative group cursor-pointer', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={href} className="block">
        {/* Poster Container */}
        <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface border border-border/40 group-hover:border-accent-green/50 transition-all">
          {posterUrl && (
            <Image
              src={posterUrl}
              alt={title}
              fill
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 150px"
              className="object-cover transition-transform duration-300 group-hover:scale-105 group-hover:brightness-105"
            />
          )}

          {/* Premium rating capsule — top right */}
          {scoreDisplay && (
            <div className="absolute top-2 right-2 bg-void/90 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-md">
              <Star size={10} className="text-accent-gold" fill="currentColor" />
              {scoreDisplay}
            </div>
          )}

          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Meta line: format + year */}
        <div className="flex justify-between text-[11px] text-text-secondary mt-1.5 px-0.5 font-medium">
          <span>{formatLabel}</span>
          <span>{year}</span>
        </div>

        {/* Title row with exact status dot positioning */}
        <div className="flex items-center gap-1.5 px-0.5 mt-0.5">
          {isAiring && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0 animate-pulse" />
          )}
          <span className="text-xs font-bold text-white line-clamp-1 group-hover:text-accent-green transition-colors">
            {title}
          </span>
        </div>
      </Link>

      {/* Edge-aware Hover Card Popover */}
      {showHoverCard && showPopover && (
        <HoverCard media={item} parentRef={cardRef} />
      )}
    </div>
  );
}
