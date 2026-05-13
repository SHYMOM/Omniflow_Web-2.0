'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatMediaType, normalizeScore, formatScore } from '@/lib/utils/formatters';
import type { AniListMedia } from '@/types/anilist';
import HoverCard from './HoverCard';

interface MediaCardProps {
  media: AniListMedia;
  className?: string;
  showHoverCard?: boolean;
}

export default function MediaCard({ media, className, showHoverCard = true }: MediaCardProps) {
  const [showPopover, setShowPopover] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const title = media.title.english || media.title.romaji;
  const posterUrl = media.coverImage?.large || media.coverImage?.extraLarge || '';
  const score = normalizeScore(media.averageScore, 'anilist');
  const isAiring = media.status === 'RELEASING';
  const formatLabel = formatMediaType(media.format || '');
  const year = media.seasonYear || media.startDate?.year || '';

  const href = media.type === 'MANGA'
    ? `/manga/${media.id}`
    : `/anime/${media.id}`;

  const handleMouseEnter = useCallback(() => {
    if (!showHoverCard) return;
    timeoutRef.current = setTimeout(() => setShowPopover(true), 400);
  }, [showHoverCard]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowPopover(false);
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn('relative group', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link href={href} className="block">
        {/* Poster */}
        <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface mb-2">
          {posterUrl && (
            <Image
              src={posterUrl}
              alt={title}
              fill
              sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 150px"
              className="object-cover transition-transform duration-300 group-hover:scale-105 group-hover:brightness-110"
            />
          )}

          {/* Rating badge — top right */}
          {score > 0 && (
            <div className="absolute top-0 right-0 bg-accent-gold text-black text-xs font-bold px-1.5 py-0.5 rounded-bl-lg flex items-center gap-0.5">
              <Star size={10} fill="currentColor" />
              {formatScore(score)}
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        </div>

        {/* Meta line: format + year */}
        <div className="flex justify-between text-[11px] text-text-secondary mb-0.5 px-0.5">
          <span>{formatLabel}</span>
          <span>{year}</span>
        </div>

        {/* Title with optional green dot */}
        <div className="flex items-center gap-1 px-0.5">
          {isAiring && (
            <span className="w-2 h-2 rounded-full bg-accent-green shrink-0" />
          )}
          <span className="text-[13px] font-medium text-white line-clamp-1">
            {title}
          </span>
        </div>
      </Link>

      {/* Hover Card Popover */}
      {showHoverCard && showPopover && (
        <HoverCard media={media} parentRef={cardRef} />
      )}
    </div>
  );
}
