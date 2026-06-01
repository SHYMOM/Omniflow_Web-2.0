'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Bookmark, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import YouTube from 'react-youtube';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import { useUserStore } from '@/store/userStore';

interface HeroBannerProps {
  items: (AniListMedia | MediaItem)[];
}

export default function HeroBanner({ items }: HeroBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [progress, setProgress] = useState(0);
  const playerRef = useRef<any>(null);
  const isMutedRef = useRef(isMuted);
  const { settings } = useUserStore();
  const autoPlayTrailer = settings?.autoPlayTrailer ?? true;

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const rawCurrent = items[currentIndex];
  const current: MediaItem | null = rawCurrent 
    ? (typeof rawCurrent.id === 'string' ? rawCurrent as MediaItem : mapAniListToMediaItem(rawCurrent as AniListMedia))
    : null;
  
  // Use background image if video error occurs
  const trailerYoutubeId = videoError ? null : current?.trailerYoutubeId;

  const navigate = useCallback((dir: 'prev' | 'next', manual = false) => {
    if (manual) setUserInteracted(true);
    setVideoError(false);
    setProgress(0);
    setCurrentIndex((prev) =>
      dir === 'prev'
        ? (prev - 1 + items.length) % items.length
        : (prev + 1) % items.length
    );
  }, [items.length]);

  // Handle mute/unmute via YT API to avoid reload
  useEffect(() => {
    if (playerRef.current && playerRef.current.mute) {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        if (playerRef.current.setVolume) playerRef.current.setVolume(100);
      }
    }
  }, [isMuted]);

  // Progress and Auto-cycle timer
  useEffect(() => {
    if (userInteracted || items.length <= 1) return;
    
    const duration = autoPlayTrailer && trailerYoutubeId ? 30000 : 8000; // 30s for trailer, 8s for image
    const interval = 100;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          navigate('next');
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [userInteracted, items.length, autoPlayTrailer, trailerYoutubeId, navigate]);

  // Reset player reference when slide changes to avoid manipulating unmounted player
  useEffect(() => {
    playerRef.current = null;
  }, [currentIndex]);

  // YouTube player handlers
  const onPlayerReady = (event: any) => {
    playerRef.current = event.target;
    if (isMutedRef.current) {
      event.target.mute();
    } else {
      event.target.unMute();
      if (event.target.setVolume) event.target.setVolume(100);
    }
  };

  const onPlayerError = () => {
    setVideoError(true);
  };

  const onPlayerEnd = () => {
    navigate('next');
  };

  if (!current) {
    return (
      <section className="relative w-full h-[75vh] min-h-[500px] bg-void overflow-hidden">
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-16 pb-16 md:pb-20">
          <div className="w-1/2 h-10 bg-white/5 animate-pulse rounded-lg mb-6" />
          <div className="flex gap-3 mb-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="w-20 h-6 bg-white/5 animate-pulse rounded-md" />)}
          </div>
          <div className="w-2/3 h-4 bg-white/5 animate-pulse rounded-md mb-2" />
          <div className="w-1/2 h-4 bg-white/5 animate-pulse rounded-md mb-8" />
          <div className="flex gap-4">
            <div className="w-32 h-12 bg-white/5 animate-pulse rounded-full" />
            <div className="w-12 h-12 bg-white/5 animate-pulse rounded-full" />
            <div className="w-12 h-12 bg-white/5 animate-pulse rounded-full" />
          </div>
        </div>
      </section>
    );
  }

  const title = current.title || 'Unknown Title';
  const description = current.description?.replace(/<[^>]*>/g, '') || '';
  const bgUrl = current.bannerUrl || current.posterUrl || '';
  const scoreLabel = current.score ? (current.source === 'anilist' ? `${Math.round(current.score * 10)}%` : `${current.score}`) : 'N/A';
  const formatLabel = current.formatLabel || 'TV Show';
  const durationLabel = current.duration || '?';
  const seasonLabel = current.season && current.seasonYear ? `${current.season} ${current.seasonYear}` : current.year ? `${current.year}` : '?';

  const isManga = current.type === 'manga';
  const watchHref = isManga ? `/read/${current.id}/1` : `/watch?id=${current.id}&type=${current.type}&ep=1`;

  return (
    <section className="relative w-full h-[75vh] min-h-[500px] overflow-hidden bg-void group">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Backdrop Image base layer */}
          {bgUrl && (
            <Image
              src={bgUrl}
              alt=""
              fill
              priority
              className="object-cover transition-transform duration-[12s] group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
          )}

          {/* Video Trailer Layer */}
          {autoPlayTrailer && trailerYoutubeId && !videoError && (
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[130%] h-[130%]">
                <YouTube
                  videoId={trailerYoutubeId}
                  opts={{
                    height: '100%',
                    width: '100%',
                    playerVars: {
                      autoplay: 1,
                      mute: 1,
                      controls: 0,
                      showinfo: 0,
                      rel: 0,
                      modestbranding: 1,
                      enablejsapi: 1,
                      iv_load_policy: 3,
                      disablekb: 1,
                      origin: typeof window !== 'undefined' ? window.location.origin : '',
                    },
                  }}
                  onReady={onPlayerReady}
                  onEnd={onPlayerEnd}
                  onError={onPlayerError}
                  className="w-full h-full"
                  iframeClassName="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Cinematic Shadow Overlays — Softened to be semi-transparent and ambient */}
          {/* Bottom Shadow - Lighter fade into void background */}
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/25 to-transparent z-[5]" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-void/80 to-transparent z-[5]" />
          
          {/* Top Shadow - Lighter gradient for header readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent z-[5]" />
        </motion.div>
      </AnimatePresence>

      {/* Main UI Content Stack */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-16 pb-16 md:pb-20 z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl pointer-events-auto"
          >
            {/* Title - Optimized size */}
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-6 drop-shadow-xl tracking-tight leading-tight">
              {title}
            </h1>

            {/* Badges Row matching pixel-perfect screenshot tags */}
            <div className="flex flex-wrap items-center gap-2.5 mb-6">
              <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-md text-[11px] font-medium text-white/80 tracking-wide">
                {formatLabel}
              </div>
              
              {scoreLabel !== 'N/A' && (
                <div className="bg-accent-green/20 backdrop-blur-md border border-accent-green/30 px-3 py-1 rounded-md text-[11px] font-bold text-accent-green tracking-wide">
                  {scoreLabel}
                </div>
              )}

              <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-md text-[11px] font-medium text-white/80 tracking-wide">
                {durationLabel}
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-md text-[11px] font-medium text-white/80 tracking-wide">
                {seasonLabel}
              </div>
            </div>

            {/* Description - Brief one-liner as seen in reference */}
            <p className="text-sm md:text-base text-white/90 line-clamp-2 mb-8 max-w-2xl font-normal drop-shadow-md leading-relaxed">
              {description}
            </p>

            {/* Action Buttons Row */}
            <div className="flex items-center gap-3">
              <Link
                href={watchHref}
                className="flex items-center gap-2.5 bg-white text-black font-bold text-[13px] px-7 py-3 rounded-full hover:bg-gray-200 transition-all active:scale-95 shadow-2xl"
              >
                <Play size={18} fill="currentColor" />
                {isManga ? 'Read Now' : 'Watch Now'}
              </Link>

              <button className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95">
                <Bookmark size={18} />
              </button>

              {autoPlayTrailer && trailerYoutubeId && !videoError && (
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Arrows - Bottom Right Horizontal as in Screenshot */}
      <div className="absolute right-6 md:right-16 bottom-16 md:bottom-20 z-30 flex items-center gap-3 pointer-events-auto">
        <button 
          onClick={() => navigate('prev', true)} 
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90 shadow-lg"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={() => navigate('next', true)} 
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-90 shadow-lg"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </section>
  );
}
