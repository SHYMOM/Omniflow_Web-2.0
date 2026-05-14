'use client';

import { useState, useEffect, type RefObject } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Bookmark, Star, Clock, Calendar, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { MediaItem } from '@/types/media';
import TypeBadge from './TypeBadge';

interface HoverCardProps {
  media: MediaItem;
  parentRef: RefObject<HTMLDivElement | null>;
}

export default function HoverCard({ media, parentRef }: HoverCardProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({
    left: '50%',
    transform: 'translateX(-50%)',
  });

  const title = media.title || 'Unknown Title';
  const description = media.description?.replace(/<[^>]*>/g, '') || '';
  const posterUrl = media.bannerUrl || media.posterUrl || '';
  const scoreLabel = media.score ? (media.source === 'anilist' ? `${Math.round(media.score * 10)}%` : `${media.score}`) : 'N/A';
  const durationLabel = media.duration || '?';
  const dateLabel = media.season && media.seasonYear ? `${media.season} ${media.seasonYear}` : media.year ? `${media.year}` : '?';
  const formatLabel = media.formatLabel || 'TV Show';
  const isAiring = media.status === 'RELEASING';
  const genres = media.genres?.slice(0, 3) || [];

  const href = media.type === 'manga' ? `/manga/${media.id}` : media.type === 'movie' ? `/movies/${media.id}` : media.type === 'tv' ? `/tv/${media.id}` : `/anime/${media.id}`;
  const watchHref = media.type === 'manga' ? href : `/watch?id=${media.id}&type=${media.type}&ep=1`;

  const trailerYoutubeId = media.trailerYoutubeId || null;
  const bgUrl = trailerYoutubeId
    ? `https://img.youtube.com/vi/${trailerYoutubeId}/hqdefault.jpg`
    : posterUrl;

  // Dynamically compute spatial positioning to avoid viewport edge clipping
  useEffect(() => {
    if (!parentRef?.current) return;
    const rect = parentRef.current.getBoundingClientRect();
    const cardWidth = 340;
    const windowWidth = window.innerWidth;

    if (rect.left < cardWidth / 2) {
      // Near left edge
      setPositionStyle({ 
        position: 'fixed',
        top: rect.top,
        left: rect.left,
      });
    } else if (windowWidth - rect.right < cardWidth / 2) {
      // Near right edge
      setPositionStyle({ 
        position: 'fixed',
        top: rect.top,
        left: rect.right - cardWidth,
      });
    } else {
      // Safe center alignment
      setPositionStyle({ 
        position: 'fixed',
        top: rect.top,
        left: rect.left + (rect.width / 2) - (cardWidth / 2),
      });
    }
  }, [parentRef]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="z-[100] w-[340px] rounded-xl overflow-hidden shadow-2xl border border-border bg-void pointer-events-auto"
      style={positionStyle}
    >
      {/* Banner / Trailer thumbnail with Auto Play iframe */}
      <div className="relative w-full aspect-video bg-surface overflow-hidden group/video">
        {trailerYoutubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${trailerYoutubeId}?autoplay=1&mute=${isMuted ? '1' : '0'}&controls=0&modestbranding=1&loop=1&playlist=${trailerYoutubeId}`}
            title={title}
            allow="autoplay; encrypted-media"
            className="absolute inset-0 w-full h-full pointer-events-none scale-105"
          />
        ) : bgUrl ? (
          <Image
            src={bgUrl}
            alt={title}
            fill
            className="object-cover"
            unoptimized={bgUrl.includes('youtube')}
          />
        ) : null}

        {/* Top-right mute control overlay */}
        {trailerYoutubeId && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute top-2 right-2 z-20 p-1.5 rounded-md bg-void/80 hover:bg-void text-white/90 hover:text-white transition-colors cursor-pointer pointer-events-auto border border-white/10"
            aria-label={isMuted ? 'Unmute trailer' : 'Mute trailer'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-void to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="p-4 pt-2">
        {/* Title */}
        <h3 className="text-base font-bold text-white mb-2 line-clamp-1">
          {title}
        </h3>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <TypeBadge label={formatLabel} />
          {isAiring && <TypeBadge label="AIRING" variant="green" />}
          {genres.map((g) => (
            <TypeBadge key={g} label={g} />
          ))}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-text-secondary mb-3">
          {scoreLabel !== 'N/A' && (
            <span className="flex items-center gap-1 text-white font-medium">
              <Star size={12} className="text-accent-gold" fill="currentColor" /> {scoreLabel}
            </span>
          )}
          {durationLabel !== '?' && (
            <span className="flex items-center gap-1">
              <Clock size={12} /> {durationLabel}
            </span>
          )}
          {dateLabel !== '?' && (
            <span className="flex items-center gap-1">
              <Calendar size={12} /> {dateLabel}
            </span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-text-secondary line-clamp-3 mb-4 leading-relaxed">
            {description}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={watchHref}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-bold text-xs py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Play size={14} fill="currentColor" />
            Watch now
          </Link>
          <button
            className="p-2.5 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-colors text-text-secondary hover:text-white cursor-pointer"
            aria-label="Add to watchlist"
          >
            <Bookmark size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
