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
    <section className="px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Jump Back In</h2>
        <Link href="/history" className="text-text-muted hover:text-white transition-colors">
          <ArrowRight size={20} strokeWidth={1.5} />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
        {(() => {
          const seen = new Set();
          return recentHistory.map((entry) => {
            const key = `${entry.mediaId}-${entry.episodeNumber}`;
            if (seen.has(key)) return null;
            seen.add(key);

            const safeMediaTitle = typeof entry.mediaTitle === 'string' ? entry.mediaTitle : ((entry.mediaTitle as any)?.english || (entry.mediaTitle as any)?.romaji || 'Unknown Series');
            const safeEpTitle = typeof entry.episodeTitle === 'string' ? entry.episodeTitle : 'Episode ' + entry.episodeNumber;

            return (
              <Link key={key} href={`/watch?id=${entry.mediaId}&type=${entry.mediaType}&ep=${entry.episodeNumber}`} className="shrink-0 w-[250px] group">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-surface mb-2">
                  {entry.thumbnailUrl && <Image src={entry.thumbnailUrl} alt={safeEpTitle} fill className="object-cover" />}
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
                    <div className="h-full bg-accent-green rounded-r" style={{ width: `${Math.min(entry.progress * 100, 100)}%` }} />
                  </div>
                </div>
                <p className="text-[13px] text-text-secondary line-clamp-1">{safeMediaTitle}</p>
                <p className="text-[14px] text-white font-medium line-clamp-1">{safeEpTitle}</p>
              </Link>
            );
          });
        })()}
      </div>
    </section>
  );
}
