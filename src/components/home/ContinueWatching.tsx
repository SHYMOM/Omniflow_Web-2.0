'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useUserStore } from '@/store/userStore';

export default function ContinueWatching() {
  const { history } = useUserStore();
  const recentHistory = history.slice(0, 6);
  if (recentHistory.length === 0) return null;

  return (
    <section className="px-4 md:px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Jump Back In</h2>
        <Link href="/history" className="flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors">
          View All <ArrowRight size={14} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {recentHistory.map((entry) => (
          <Link key={`${entry.mediaId}-${entry.episodeNumber}`} href={`/watch?id=${entry.mediaId}&type=${entry.mediaType}&ep=${entry.episodeNumber}`} className="shrink-0 w-[250px] group">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-surface mb-2">
              {entry.thumbnailUrl && <Image src={entry.thumbnailUrl} alt={entry.episodeTitle} fill className="object-cover" />}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
                <div className="h-full bg-accent-green rounded-r" style={{ width: `${Math.min(entry.progress * 100, 100)}%` }} />
              </div>
            </div>
            <p className="text-[13px] text-text-secondary line-clamp-1">{entry.mediaTitle}</p>
            <p className="text-[14px] text-white font-medium line-clamp-1">{entry.episodeTitle}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
