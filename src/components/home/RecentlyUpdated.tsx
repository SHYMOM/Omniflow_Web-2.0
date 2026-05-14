'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Play } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import { mapAniListToMediaItem } from '@/lib/api/hybrid';

interface RecentlyUpdatedProps {
  items: (AniListMedia | MediaItem)[];
}

export default function RecentlyUpdated({ items }: RecentlyUpdatedProps) {
  if (!items.length) return null;

  return (
    <section className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Recently Updated</h2>
        <Link
          href="/season"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors"
        >
          View All <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {(() => {
          const seen = new Set();
          return items.map((rawMedia, index) => {
            const item = typeof rawMedia.id === 'string' ? rawMedia as MediaItem : mapAniListToMediaItem(rawMedia as AniListMedia);
            if (seen.has(item.id)) return null;
            seen.add(item.id);

            const title = item.title || 'Unknown Title';
            const posterUrl = item.posterUrl || '';
            const bannerUrl = item.bannerUrl || posterUrl;
            const latestEp = item.episodeCount || '?';

            const targetHref = item.type === 'manga' ? `/manga/${item.id}` : item.type === 'movie' ? `/movies/${item.id}` : item.type === 'tv' ? `/tv/${item.id}` : `/anime/${item.id}`;

            return (
              <Link
                key={item.id}
                href={targetHref}
                className="group"
              >
              {/* Thumbnail (16:9) */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-surface mb-2">
                {bannerUrl && (
                  <Image
                    src={bannerUrl}
                    alt={title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                )}
                {/* Episode badge */}
                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] px-1.5 py-0.5 rounded">
                  Ep {latestEp}
                </span>
                {/* Play overlay on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <Play
                    size={32}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="currentColor"
                  />
                </div>
              </div>

              {/* Channel row */}
              <div className="flex gap-2 items-start">
                {/* Circular poster thumbnail */}
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface shrink-0 mt-0.5">
                  {posterUrl && (
                    <Image src={posterUrl} alt="" fill className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-white line-clamp-1">
                    Episode {latestEp}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-[12px] text-text-secondary line-clamp-1 flex-1">
                      {title}
                    </p>
                    <span className="text-[10px] text-text-muted whitespace-nowrap">
                      {index % 3 === 0 ? '4h ago' : index % 2 === 0 ? '1d ago' : '2h ago'}
                    </span>
                  </div>
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
