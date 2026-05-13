'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { AniListMedia } from '@/types/anilist';
import { formatMediaType } from '@/lib/utils/formatters';

interface MoreLikeThisTabProps { media: AniListMedia; }

export default function MoreLikeThisTab({ media }: MoreLikeThisTabProps) {
  const recommendations = (media.recommendations?.nodes || [])
    .map(n => n.mediaRecommendation)
    .filter(Boolean);

  return (
    <div className="pb-8">
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
        {recommendations.map((rec) => {
          if (!rec) return null;
          const title = rec.title.english || rec.title.romaji;
          const href = rec.type === 'MANGA' ? `/manga/${rec.id}` : `/anime/${rec.id}`;
          return (
            <Link key={rec.id} href={href} className="group">
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface mb-1.5">
                <Image src={rec.coverImage.large} alt={title} fill className="object-cover group-hover:scale-105 transition-transform" />
              </div>
              <p className="text-[11px] text-text-secondary">{formatMediaType(rec.format)} {rec.seasonYear || ''}</p>
              <p className="text-[13px] text-white line-clamp-1">{title}</p>
            </Link>
          );
        })}
      </div>
      {recommendations.length === 0 && <p className="text-center text-text-muted py-8">No recommendations found.</p>}
    </div>
  );
}
