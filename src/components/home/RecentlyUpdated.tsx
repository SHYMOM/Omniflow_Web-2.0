'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Play } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';

interface RecentlyUpdatedProps {
  items: AniListMedia[];
}

export default function RecentlyUpdated({ items }: RecentlyUpdatedProps) {
  if (!items.length) return null;

  return (
    <section className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Recently Updated</h2>
        <Link
          href="/search?sort=updated"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors"
        >
          View All <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((media) => {
          const title = media.title.english || media.title.romaji;
          const posterUrl = media.coverImage?.large || media.coverImage?.extraLarge || '';
          const bannerUrl = media.bannerImage || posterUrl;
          const latestEp = media.nextAiringEpisode
            ? media.nextAiringEpisode.episode - 1
            : media.episodes || '?';

          return (
            <Link
              key={media.id}
              href={`/watch?id=${media.id}&type=anime&ep=${latestEp}`}
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
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white line-clamp-1">
                    Episode {latestEp}
                  </p>
                  <p className="text-[12px] text-text-secondary line-clamp-1">
                    {title}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
