'use client';

import Link from 'next/link';
import Image from 'next/image';
import { X, Star } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { formatScore } from '@/lib/utils/formatters';

export default function WatchlistPage() {
  const { watchlist, removeFromWatchlist } = useUserStore();

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">My List</h1>

      {watchlist.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted text-lg mb-2">Your watchlist is empty</p>
          <p className="text-text-muted text-sm mb-4">Start adding shows you want to watch!</p>
          <Link href="/search" className="text-accent-green hover:underline">Browse content →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {watchlist.map((entry) => (
            <div key={entry.mediaId} className="relative group">
              <Link href={`/${entry.mediaType}/${entry.mediaId.replace(/^anilist-/, '')}`}>
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface mb-2">
                  <Image src={entry.posterUrl} alt={entry.title} fill className="object-cover group-hover:scale-105 transition-transform" />
                  {entry.score > 0 && (
                    <div className="absolute top-0 right-0 bg-accent-gold text-black text-xs font-bold px-1.5 py-0.5 rounded-bl-lg flex items-center gap-0.5">
                      <Star size={10} fill="currentColor" />{formatScore(entry.score)}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary">{entry.formatLabel} {entry.year}</p>
                <p className="text-[13px] text-white line-clamp-1">{entry.title}</p>
              </Link>
              <button onClick={() => removeFromWatchlist(entry.mediaId)} className="absolute top-1 left-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent-red">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
