'use client';

import { useState, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
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
  const enterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Adapt input media seamlessly to unified MediaItem schema
  const item: MediaItem = typeof media.id === 'string' ? media as MediaItem : mapAniListToMediaItem(media as AniListMedia);

  const title = item.title || 'Unknown Title';
  const posterUrl = item.posterUrl || item.bannerUrl || '';
  const scoreDisplay = item.score ? (item.score > 10 ? (item.score / 10).toFixed(1) : item.score.toFixed(1)) : null;
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
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    enterTimeoutRef.current = setTimeout(() => setShowPopover(true), 400);
  }, [showHoverCard]);

  const handleMouseLeave = useCallback(() => {
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    leaveTimeoutRef.current = setTimeout(() => setShowPopover(false), 200);
  }, []);

  const handlePopoverMouseEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  }, []);

  const handlePopoverMouseLeave = useCallback(() => {
    leaveTimeoutRef.current = setTimeout(() => setShowPopover(false), 200);
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn('relative group cursor-pointer w-full', className)}
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
            <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-[2px] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] flex items-center gap-1 shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              <Star size={9} className="text-accent-gold" fill="currentColor" stroke="none" />
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
        <div className="flex items-start gap-1.5 px-0.5 mt-1">
          <span className="w-2 h-2 rounded-full bg-accent-green shrink-0 mt-[4px]" />
          <span className="text-[12px] font-bold text-white leading-snug line-clamp-2 group-hover:text-accent-green transition-colors">
            {title}
          </span>
        </div>
      </Link>

      {/* Edge-aware Hover Card Popover */}
      <AnimatePresence>
        {showHoverCard && showPopover && (
          <HoverCard 
            media={item} 
            parentRef={cardRef} 
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handlePopoverMouseLeave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
