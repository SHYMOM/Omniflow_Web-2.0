'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import MediaRow from '@/components/media/MediaRow';

interface TrendingRowProps {
  title?: string;
  href?: string;
  items: (AniListMedia | MediaItem)[];
  loading?: boolean;
  onLoadMore?: () => void;
}

export default function TrendingRow({ title = "Trending Now", href = "/trending", items, loading, onLoadMore }: TrendingRowProps) {
  return (
    <section className="px-4 md:px-6 py-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <Link
          href={href}
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors"
        >
          View All <ArrowRight size={14} />
        </Link>
      </div>

      <MediaRow items={items} loading={loading} onLoadMore={onLoadMore} />
    </section>
  );
}
