'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import MediaRow from '@/components/media/MediaRow';

interface TrendingRowProps {
  items: (AniListMedia | MediaItem)[];
  loading?: boolean;
}

export default function TrendingRow({ items, loading }: TrendingRowProps) {
  return (
    <section className="px-4 md:px-6 py-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Trending Now</h2>
        <Link
          href="/trending"
          className="flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors"
        >
          View All <ArrowRight size={14} />
        </Link>
      </div>

      <MediaRow items={items} loading={loading} />
    </section>
  );
}
