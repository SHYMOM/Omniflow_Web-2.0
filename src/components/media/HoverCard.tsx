'use client';

import { useState, useEffect, useRef, type RefObject } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Play, Bookmark, Star, Clock, Calendar, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { MediaItem } from '@/types/media';
import TypeBadge from './TypeBadge';
import Portal from '@/components/ui/Portal';

interface HoverCardProps {
  media: MediaItem;
  parentRef: RefObject<HTMLDivElement | null>;
}

export default function HoverCard({ media, parentRef }: HoverCardProps) {
  const [isMuted, setIsMuted] = useState(true);
  const playerRef = useRef<any>(null);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    visibility: 'hidden',
    pointerEvents: 'none',
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

  // Sync mute state via YT API to avoid iframe reload
  useEffect(() => {
    if (playerRef.current && playerRef.current.mute) {
      if (isMuted) playerRef.current.mute();
      else playerRef.current.unMute();
    }
  }, [isMuted]);

  useEffect(() => {
    if (!parentRef?.current) return;
    const rect = parentRef.current.getBoundingClientRect();
    const cardWidth = 340;
    const windowWidth = window.innerWidth;
    
    const isOnRightHalf = rect.left > windowWidth * 0.5;
    let leftPos = rect.left + rect.width + 12;

    if (isOnRightHalf || (leftPos + cardWidth > windowWidth - 10)) {
      leftPos = rect.left - cardWidth - 12;
    }

    setPositionStyle({ 
      position: 'fixed',
      top: Math.max(20, rect.top - 20),
      left: leftPos,
      visibility: 'visible',
      pointerEvents: 'auto',
    });
  }, [parentRef]);

  // YouTube API Integration for cinematic control
  useEffect(() => {
    if (!trailerYoutubeId) return;

    const setupPlayer = () => {
      try {
        playerRef.current = new (window as any).YT.Player(`hover-player-${media.id}`, {
          events: {
            'onReady': (event: any) => {
              if (isMuted) event.target.mute();
              else event.target.unMute();
            },
            'onStateChange': (event: any) => {
               // Prevent video from pausing if possible or handle other states
            }
          }
        });
      } catch (e) {}
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      (window as any).onYouTubeIframeAPIReady = setupPlayer;
    } else if ((window as any).YT.Player) {
      setupPlayer();
    }

    return () => {
      if (playerRef.current?.destroy) playerRef.current.destroy();
    };
  }, [media.id, trailerYoutubeId]);

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="z-[9999] w-[340px] rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 bg-void/90 backdrop-blur-2xl pointer-events-auto select-none"
        style={positionStyle}
      >
        <div className="relative w-full aspect-video bg-surface overflow-hidden">
          {trailerYoutubeId ? (
            <div className="absolute inset-0">
              <iframe
                id={`hover-player-${media.id}`}
                src={`https://www.youtube.com/embed/${trailerYoutubeId}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${trailerYoutubeId}&enablejsapi=1&iv_load_policy=3&rel=0&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
                title={title}
                allow="autoplay; encrypted-media"
                className="absolute inset-0 w-full h-full pointer-events-none scale-[1.3] object-cover"
              />
              {/* Cinematic Vignette Overlay to hide YT UI */}
              <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.7)] bg-gradient-to-t from-void/40 via-transparent to-transparent" />
              <div className="absolute inset-0 z-20 pointer-events-auto bg-transparent" />
            </div>
          ) : bgUrl ? (
            <Image src={bgUrl} alt={title} fill className="object-cover" unoptimized={bgUrl.includes('youtube')} />
          ) : null}

          {trailerYoutubeId && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="absolute top-3 right-3 z-30 p-2 rounded-lg bg-void/80 hover:bg-void text-white transition-colors cursor-pointer border border-white/10"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}

          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-void via-void/50 to-transparent pointer-events-none" />
        </div>

        <div className="p-4 pt-2">
          <h3 className="text-base font-bold text-white mb-2 line-clamp-1">{title}</h3>
          
          <div className="flex flex-wrap gap-1.5 mb-3">
            <TypeBadge label={formatLabel} />
            {isAiring && <TypeBadge label="AIRING" variant="green" />}
            {genres.map(g => <TypeBadge key={g} label={g} />)}
          </div>

          <div className="flex items-center gap-3 text-xs text-text-secondary mb-3">
            {scoreLabel !== 'N/A' && (
              <span className="flex items-center gap-1 text-white font-medium">
                <Star size={12} className="text-accent-gold" fill="currentColor" /> {scoreLabel}
              </span>
            )}
            <span className="flex items-center gap-1"><Clock size={12} /> {durationLabel}</span>
            <span className="flex items-center gap-1"><Calendar size={12} /> {dateLabel}</span>
          </div>

          <p className="text-xs text-text-secondary line-clamp-3 mb-4 leading-relaxed">{description}</p>

          <div className="flex gap-2">
            <Link
              href={watchHref}
              className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-bold text-xs py-2.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Play size={14} fill="currentColor" /> Watch now
            </Link>
            <button className="p-2.5 rounded-lg bg-surface border border-border hover:bg-surface-hover transition-colors text-text-secondary hover:text-white cursor-pointer">
              <Bookmark size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </Portal>
  );
}
