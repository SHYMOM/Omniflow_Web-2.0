'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';
import { formatCountdown } from '@/lib/utils/formatters';

interface TopUpcomingProps {
  items: (AniListMedia | MediaItem)[];
}

export default function TopUpcoming({ items }: TopUpcomingProps) {
  if (!items.length) return null;

  return (
    <section className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Top Upcoming</h2>
        <Link
          href="/upcoming"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors"
        >
          View All <ArrowRight size={14} />
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
        {(() => {
          const seen = new Set();
          return items.map((rawMedia) => {
            const item = typeof rawMedia.id === 'string' ? rawMedia as MediaItem : mapAniListToMediaItem(rawMedia as AniListMedia);
            if (seen.has(item.id)) return null;
            seen.add(item.id);

            const title = item.title || 'Unknown Title';
            const posterUrl = item.posterUrl || '';
            const description = item.description || '';
            const studioName = item.studios?.[0] || '';
            const genres = item.genres?.slice(0, 3) || [];
            const sourceLabel = item.sourceMedia || '';

            // Calculate countdown
            let countdown = '';
            const targetYear = item.seasonYear || item.year;
            if (targetYear) {
              const targetDate = new Date(targetYear, 0, 1);
              countdown = formatCountdown(targetDate.getTime() / 1000);
            }

            const targetHref = item.type === 'manga' ? `/manga/${item.id}` : item.type === 'movie' ? `/movies/${item.id}` : item.type === 'tv' ? `/tv/${item.id}` : `/anime/${item.id}`;

            return (
              <Link
                key={item.id}
                href={targetHref}
                className="shrink-0 w-[380px] bg-surface rounded-xl overflow-hidden border border-border hover:border-accent-green/30 transition-colors group"
              >
              <div className="flex p-4 gap-4">
                {/* Poster */}
                <div className="relative w-[120px] h-[170px] rounded-lg overflow-hidden shrink-0 bg-void">
                  {posterUrl && (
                    <Image
                      src={posterUrl}
                      alt={title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {countdown && (
                    <p className="text-[12px] text-text-secondary mb-1">
                      Ep 1 airing in{' '}
                      <span className="text-accent-green font-medium">{countdown}</span>
                    </p>
                  )}
                  {sourceLabel && (
                    <p className="text-[11px] text-text-muted mb-2">
                      Source: {sourceLabel.replace(/_/g, ' ')}
                    </p>
                  )}
                  <p className="text-[13px] text-text-secondary line-clamp-3">
                    {description}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4">
                <h3 className="text-[15px] font-semibold text-white line-clamp-1 mb-1">
                  {title}
                </h3>
                {studioName && (
                  <p className="text-[12px] text-accent-green uppercase font-bold tracking-wide mb-2">
                    {studioName}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="text-[11px] text-accent-green bg-accent-green/10 px-2 py-0.5 rounded"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
            );
          });
        })()}
      </div>
    </section>
  );
}
