'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface EpisodeSidebarProps {
  mediaId: number;
  mediaType: string;
  currentEp: number;
  malId: number;
  totalEpisodes: number;
  title: string;
}

export default function EpisodeSidebar({ mediaId, mediaType, currentEp, totalEpisodes, title }: EpisodeSidebarProps) {
  const episodes = Array.from({ length: totalEpisodes || 24 }, (_, i) => i + 1);

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border">
        <p className="text-xs text-text-secondary">Playing</p>
        <p className="text-sm text-white font-medium line-clamp-1">Episode {currentEp} - {title}</p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto hide-scrollbar">
        {episodes.map((ep) => (
          <Link key={ep} href={`/watch?id=${mediaId}&type=${mediaType}&ep=${ep}`} className={cn('flex items-center gap-3 px-3 py-2.5 transition-colors text-sm', ep === currentEp ? 'bg-surface-hover border-l-2 border-accent-green text-white' : 'text-text-secondary hover:bg-surface-hover hover:text-white')}>
            <span className="w-8 text-right text-xs text-text-muted">{ep}</span>
            <span className="line-clamp-1">Episode {ep}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
