'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Play, Bookmark, Share2, ExternalLink, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { AniListMedia } from '@/types/anilist';
import TypeBadge from '@/components/media/TypeBadge';
import { formatMediaType, formatSeason, formatCountdown } from '@/lib/utils/formatters';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils/cn';
import type { MediaItem } from '@/types/media';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';

interface DetailHeaderProps {
  media: AniListMedia | MediaItem;
  mediaType: 'anime' | 'movie' | 'tv' | 'manga';
}

export default function DetailHeader({ media, mediaType }: DetailHeaderProps) {
  const router = useRouter();
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useUserStore();

  const item: MediaItem = typeof media.id === 'string' ? media as MediaItem : mapAniListToMediaItem(media as AniListMedia);

  const title = item.title;
  const bannerUrl = item.bannerUrl || item.posterUrl || '';
  const posterUrl = item.posterUrl || '';
  const formatLabel = item.formatLabel;
  const seasonLabel = formatSeason(item.season as any, item.seasonYear);
  const isAiring = item.status === 'RELEASING';
  const mediaId = item.id;
  const inWatchlist = isInWatchlist(mediaId);

  const watchHref = mediaType === 'manga' ? `/read/${item.id}/1` : `/watch?id=${item.id}&type=${mediaType}&ep=1`;

  const handleWatchlist = () => {
    if (inWatchlist) {
      removeFromWatchlist(mediaId);
    } else {
      addToWatchlist({
        ...item,
        addedAt: new Date().toISOString(),
        mediaId: item.id,
        mediaType,
      } as any);
    }
  };

  return (
    <div className="relative">
      {/* Banner */}
      <div className="relative w-full h-[250px] md:h-[300px] overflow-hidden">
        {bannerUrl && <Image src={bannerUrl} alt="" fill className="object-cover" priority />}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-transparent" />
      </div>

      {/* Back button */}
      <button onClick={() => router.back()} className="absolute top-4 left-4 z-10 p-2 rounded-lg bg-surface/80 text-white hover:bg-surface">
        <ArrowLeft size={20} />
      </button>

      {/* Content overlay */}
      <div className="relative -mt-24 px-4 md:px-6 max-w-7xl mx-auto z-10">
        <div className="flex gap-5 items-end">
          {/* Poster */}
          <div className="relative w-[120px] md:w-[140px] h-[170px] md:h-[200px] rounded-xl overflow-hidden border-2 border-border shadow-xl shrink-0">
            {posterUrl && <Image src={posterUrl} alt={title} fill className="object-cover" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-2">
            {isAiring && <TypeBadge label="AIRING" variant="green" className="mb-2" />}
            <h1 className="text-xl md:text-2xl font-bold text-white mb-2 line-clamp-2">{title}</h1>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <TypeBadge label={formatLabel} />
              {seasonLabel !== '?' && <TypeBadge label={seasonLabel} />}
              {item.episodeCount && <TypeBadge label={`${item.episodeCount} eps`} />}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Link href={watchHref} className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                <Play size={16} fill="currentColor" /> {mediaType === 'manga' ? 'Read Now' : 'Watch Now'}
              </Link>
              <button onClick={handleWatchlist} className={cn('p-2 rounded-lg border transition-colors', inWatchlist ? 'bg-accent-green/20 border-accent-green text-accent-green' : 'bg-surface border-border text-text-secondary hover:text-white')}>
                <Bookmark size={18} fill={inWatchlist ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-white">
                <Share2 size={18} />
              </button>
              {item.malId && (
                <a href={`https://myanimelist.net/anime/${item.malId}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-[#2e51a2] text-white text-[10px] font-bold flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm" title="View on MyAnimeList">
                  MAL
                </a>
              )}
              {item.anilistId && (
                <a href={`https://anilist.co/anime/${item.anilistId}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-[#02a9ff] text-white text-[11px] font-bold flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm" title="View on AniList">
                  A.
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Next episode notice */}
        {item.nextAiringEpisode && (
          <div className="mt-4 py-3 px-4 bg-surface border border-border rounded-lg text-center text-sm">
            🔔 <span className="text-text-secondary">Next ep airing</span>{' '}
            <span className="text-accent-green font-medium">in {formatCountdown(item.nextAiringEpisode.airingAt)}</span>
          </div>
        )}

      </div>
    </div>
  );
}
