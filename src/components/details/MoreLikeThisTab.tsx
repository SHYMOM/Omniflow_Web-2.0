'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { MediaItem } from '@/types/media';

interface MoreLikeThisTabProps { media: MediaItem; }

export default function MoreLikeThisTab({ media }: MoreLikeThisTabProps) {
  const recommendations = media.recommendations || [];

  return (
    <div className="pb-8">
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
        {(() => {
          const seen = new Set();
          return recommendations.map((rec, idx) => {
            if (!rec) return null;
            if (seen.has(rec.id)) return null;
            seen.add(rec.id);

            const href = `/${rec.type}/${rec.id}`;
            return (
              <Link key={`${rec.id}-${idx}`} href={href} className="group">
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface mb-1.5 border border-border/30">
                  <Image src={rec.posterUrl} alt={rec.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                </div>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">
                  {rec.formatLabel} {rec.year || ''}
                </p>
                <p className="text-[13px] text-white line-clamp-1 group-hover:text-accent-green transition-colors font-medium">
                  {rec.title}
                </p>
              </Link>
            );
          });
        })()}
      </div>
      {recommendations.length === 0 && (
        <div className="text-center py-12 bg-surface/20 rounded-xl border border-dashed border-border">
          <p className="text-text-muted text-sm italic">No recommendations found for this title.</p>
        </div>
      )}
    </div>
  );
}
