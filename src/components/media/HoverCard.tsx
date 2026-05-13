'use client';

import { type RefObject } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Bookmark, Star, Clock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatMediaType, formatScorePercent, formatDuration, formatDate } from '@/lib/utils/formatters';
import type { AniListMedia } from '@/types/anilist';
import TypeBadge from './TypeBadge';

interface HoverCardProps {
  media: AniListMedia;
  parentRef: RefObject<HTMLDivElement | null>;
}

export default function HoverCard({ media }: HoverCardProps) {
  const title = media.title.english || media.title.romaji;
  const description = media.description?.replace(/<[^>]*>/g, '') || '';
  const posterUrl = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || '';
  const scoreLabel = formatScorePercent(media.averageScore, 'anilist');
  const durationLabel = formatDuration(media.duration);
  const dateLabel = formatDate(undefined, media.startDate);
  const formatLabel = formatMediaType(media.format || '');
  const isAiring = media.status === 'RELEASING';
  const genres = media.genres?.slice(0, 3) || [];

  const href = media.type === 'MANGA' ? `/manga/${media.id}` : `/anime/${media.id}`;
  const watchHref = media.idMal
    ? `/watch?id=${media.id}&type=anime&ep=1`
    : href;

  const trailerYoutubeId = media.trailer?.site === 'youtube' ? media.trailer.id : null;
  const bgUrl = trailerYoutubeId
    ? `https://img.youtube.com/vi/${trailerYoutubeId}/hqdefault.jpg`
    : posterUrl;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute z-50 left-1/2 -translate-x-1/2 top-0 w-[340px] rounded-xl overflow-hidden shadow-2xl border border-border bg-void"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Banner / Trailer thumbnail */}
      <div className="relative w-full aspect-video bg-surface overflow-hidden">
        {bgUrl && (
          <Image
            src={bgUrl}
            alt={title}
            fill
            className="object-cover"
            unoptimized={bgUrl.includes('youtube')}
          />
        )}
        {trailerYoutubeId && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Play size={40} className="text-white/80" fill="currentColor" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-12 gradient-fade-b" />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-2 line-clamp-1">
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
        <div className="flex items-center gap-3 text-[13px] text-text-secondary mb-3">
          {scoreLabel !== 'N/A' && (
            <span className="flex items-center gap-1 text-accent-gold">
              <Star size={12} fill="currentColor" /> {scoreLabel}
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
          <p className="text-[13px] text-text-secondary line-clamp-3 mb-4">
            {description}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link
            href={watchHref}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Play size={16} fill="currentColor" />
            Watch Now
          </Link>
          <button
            className="p-2.5 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-colors text-text-secondary hover:text-white"
            aria-label="Add to watchlist"
          >
            <Bookmark size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
