'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Bookmark, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import TypeBadge from '@/components/media/TypeBadge';
import { useUserStore } from '@/store/userStore';

interface HeroBannerProps {
  items: (AniListMedia | MediaItem)[];
}

export default function HeroBanner({ items }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const { settings } = useUserStore();
  const autoPlayTrailer = settings?.autoPlayTrailer ?? true;

  const rawCurrent = items[currentIndex];
  const current: MediaItem | null = rawCurrent 
    ? (typeof rawCurrent.id === 'string' ? rawCurrent as MediaItem : mapAniListToMediaItem(rawCurrent as AniListMedia))
    : null;
  const trailerYoutubeId = current?.trailerYoutubeId;

  const navigate = useCallback((dir: 'prev' | 'next') => {
    setUserInteracted(true);
    setCurrentIndex((prev) =>
      dir === 'prev'
        ? (prev - 1 + items.length) % items.length
        : (prev + 1) % items.length
    );
  }, [items.length]);

  // Auto-cycle banner slides sequentially
  useEffect(() => {
    if (userInteracted || items.length <= 1) return;
    
    // If we have a trailer playing, we wait for it to end.
    // If not, we use the fallback timer.
    if (autoPlayTrailer && trailerYoutubeId) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 12000);
    return () => clearInterval(timer);
  }, [userInteracted, items.length, autoPlayTrailer, trailerYoutubeId]);

  // YouTube API integration for end-of-video detection
  useEffect(() => {
    if (!autoPlayTrailer || !trailerYoutubeId) return;

    let player: any;

    const onPlayerStateChange = (event: any) => {
      if (event.data === (window as any).YT?.PlayerState?.ENDED) {
        navigate('next');
      }
    };

    const setupPlayer = () => {
      try {
        player = new (window as any).YT.Player(`hero-player-${currentIndex}`, {
          events: {
            'onStateChange': onPlayerStateChange
          }
        });
      } catch (err) {
        console.warn('YT Player init failed', err);
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = setupPlayer;
    } else if ((window as any).YT.Player) {
      setupPlayer();
    }

    return () => {
      if (player && player.destroy) {
        try { player.destroy(); } catch(e) {}
      }
    };
  }, [currentIndex, trailerYoutubeId, autoPlayTrailer, navigate]);

  if (!current) return null;

  const title = current.title || 'Unknown Title';
  const description = current.description?.replace(/<[^>]*>/g, '') || '';
  const bgUrl = current.bannerUrl || current.posterUrl || '';
  const scoreLabel = current.score ? (current.source === 'anilist' ? `${Math.round(current.score * 10)}%` : `${current.score}`) : 'N/A';
  const formatLabel = current.formatLabel || 'TV Show';
  const durationLabel = current.duration || '?';
  const seasonLabel = current.season && current.seasonYear ? `${current.season} ${current.seasonYear}` : current.year ? `${current.year}` : '?';

  const scoreVariant = (current.score || 0) > 7.5 ? 'green' : 'default';

  const href = current.type === 'manga' ? `/manga/${current.id}` : current.type === 'movie' ? `/movies/${current.id}` : current.type === 'tv' ? `/tv/${current.id}` : `/anime/${current.id}`;
  const watchHref = current.type === 'manga' ? href : `/watch?id=${current.id}&type=${current.type}&ep=1`;

  return (
    <section className="relative w-full h-[70vh] min-h-[400px] max-h-[700px] overflow-hidden bg-void">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Dynamic Auto Play Trailer or Background Image */}
          {autoPlayTrailer && trailerYoutubeId ? (
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
              <iframe
                id={`hero-player-${currentIndex}`}
                src={`https://www.youtube.com/embed/${trailerYoutubeId}?autoplay=1&mute=${isMuted ? '1' : '0'}&controls=0&showinfo=0&rel=0&modestbranding=1&enablejsapi=1&iv_load_policy=3&disablekb=1&widget_referrer=${typeof window !== 'undefined' ? window.location.origin : ''}&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                title={title}
                allow="autoplay; encrypted-media"
                className="absolute w-[105vw] h-[105vh] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              />
            </div>
          ) : bgUrl ? (
            <Image
              src={bgUrl}
              alt={title}
              fill
              priority
              className="object-cover"
              style={{ animation: 'ken-burns 20s ease-in-out infinite' }}
            />
          ) : null}

          {/* Premium Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/80 to-transparent md:w-2/3" />
        </motion.div>
      </AnimatePresence>

      {/* Content — bottom left */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-10 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-[650px] pointer-events-auto"
          >
            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 line-clamp-2 font-display tracking-wide">
              {title}
            </h1>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <TypeBadge label={formatLabel} />
              {scoreLabel !== 'N/A' && <TypeBadge label={scoreLabel} variant={scoreVariant} />}
              {durationLabel !== '?' && <TypeBadge label={durationLabel} />}
              {seasonLabel !== '?' && <TypeBadge label={seasonLabel} />}
            </div>

            {/* Description */}
            <p className="text-xs md:text-sm text-text-secondary line-clamp-3 mb-6 max-w-[550px] leading-relaxed">
              {description}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={watchHref}
                className="flex items-center gap-2 bg-white text-black font-bold text-xs md:text-sm px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors shadow-lg cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                Watch now
              </Link>
              <button
                className="p-3 rounded-lg bg-surface/80 backdrop-blur-md border border-border hover:bg-surface transition-colors text-white cursor-pointer"
                aria-label="Add to watchlist"
              >
                <Bookmark size={18} />
              </button>
              {autoPlayTrailer && trailerYoutubeId && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-3 rounded-lg bg-surface/80 backdrop-blur-md border border-border hover:bg-surface transition-colors text-white cursor-pointer"
                  aria-label={isMuted ? 'Unmute trailer' : 'Mute trailer'}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Carousel nav arrows — right side */}
      <div className="absolute right-6 bottom-8 z-10 flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => navigate('prev')}
          className="w-10 h-10 rounded-full bg-surface/80 backdrop-blur-md border border-border flex items-center justify-center text-white hover:bg-surface transition-colors cursor-pointer"
          aria-label="Previous slide"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => navigate('next')}
          className="w-10 h-10 rounded-full bg-surface/80 backdrop-blur-md border border-border flex items-center justify-center text-white hover:bg-surface transition-colors cursor-pointer"
          aria-label="Next slide"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Slide indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 pointer-events-auto">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => { setUserInteracted(true); setCurrentIndex(i); }}
            className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
              i === currentIndex ? 'bg-accent-green w-6' : 'bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
