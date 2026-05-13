'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Bookmark, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import TypeBadge from '@/components/media/TypeBadge';
import { formatMediaType, formatScorePercent, formatDuration, formatSeason } from '@/lib/utils/formatters';

interface HeroBannerProps {
  items: AniListMedia[];
}

export default function HeroBanner({ items }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);

  // Auto-cycle
  useEffect(() => {
    if (userInteracted || items.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [userInteracted, items.length]);

  const navigate = useCallback((dir: 'prev' | 'next') => {
    setUserInteracted(true);
    setCurrentIndex((prev) =>
      dir === 'prev'
        ? (prev - 1 + items.length) % items.length
        : (prev + 1) % items.length
    );
  }, [items.length]);

  const current = items[currentIndex];
  if (!current) return null;

  const title = current.title.english || current.title.romaji;
  const description = current.description?.replace(/<[^>]*>/g, '') || '';
  const bgUrl = current.bannerImage || current.coverImage?.extraLarge || '';
  const scoreLabel = formatScorePercent(current.averageScore, 'anilist');
  const formatLabel = formatMediaType(current.format || '');
  const durationLabel = formatDuration(current.duration);
  const seasonLabel = formatSeason(current.season, current.seasonYear);

  const scoreVariant = (current.averageScore || 0) > 75 ? 'green' : 'default';

  const href = `/anime/${current.id}`;
  const watchHref = `/watch?id=${current.id}&type=anime&ep=1`;

  return (
    <section className="relative w-full h-[70vh] min-h-[400px] max-h-[700px] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Background Image with Ken Burns */}
          {bgUrl && (
            <Image
              src={bgUrl}
              alt={title}
              fill
              priority
              className="object-cover"
              style={{ animation: 'ken-burns 20s ease-in-out infinite' }}
            />
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-void/80 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Content — bottom left */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-[600px]"
          >
            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 line-clamp-2">
              {title}
            </h1>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <TypeBadge label={formatLabel} />
              {scoreLabel !== 'N/A' && <TypeBadge label={scoreLabel} variant={scoreVariant} />}
              {durationLabel !== '?' && <TypeBadge label={durationLabel} />}
              {seasonLabel !== '?' && <TypeBadge label={seasonLabel} />}
            </div>

            {/* Description */}
            <p className="text-sm text-text-secondary line-clamp-2 mb-5 max-w-[500px]">
              {description}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={watchHref}
                className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Play size={16} fill="currentColor" />
                Watch Now
              </Link>
              <button
                className="p-2.5 rounded-lg bg-surface/80 border border-border hover:bg-surface transition-colors text-white"
                aria-label="Add to watchlist"
              >
                <Bookmark size={18} />
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2.5 rounded-lg bg-surface/80 border border-border hover:bg-surface transition-colors text-white"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Carousel nav arrows — right side */}
      <div className="absolute right-6 bottom-8 z-10 flex items-center gap-2">
        <button
          onClick={() => navigate('prev')}
          className="w-10 h-10 rounded-full bg-surface/80 border border-border flex items-center justify-center text-white hover:bg-surface transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => navigate('next')}
          className="w-10 h-10 rounded-full bg-surface/80 border border-border flex items-center justify-center text-white hover:bg-surface transition-colors"
          aria-label="Next"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => { setUserInteracted(true); setCurrentIndex(i); }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentIndex ? 'bg-white w-6' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
