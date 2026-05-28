'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getHybridSchedule } from '@/lib/api/hybrid';

export default function RecentlyUploaded() {
  const [recent, setRecent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecent() {
      try {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[new Date().getDay()];
        const schedule = await getHybridSchedule(today);
        setRecent(schedule.slice(0, 6)); // top 6
      } catch (err) {
        console.error('Failed to fetch recently uploaded', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, []);

  if (loading) {
    return (
      <div className="bg-void rounded-xl border border-border p-3.5 shadow-lg mt-4 animate-pulse">
        <h3 className="text-sm font-bold text-white mb-3">Recently Airing</h3>
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-12 h-16 rounded bg-surface border border-border shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-surface rounded w-3/4" />
                <div className="h-2 bg-surface rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (recent.length === 0) return null;

  return (
    <div className="bg-void rounded-xl border border-border p-3.5 shadow-lg mt-4">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
        Airing Today
      </h3>
      <div className="space-y-2.5">
        {recent.map((item, idx) => {
          // Both Jikan and AniList schedule objects mapped to a consistent format
          const id = item.mal_id || item.id;
          const title = item.title || item.title_english || 'Unknown Title';
          const episode = item.episodes || item.episode || '?';
          const poster = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/default.jpg';
          
          return (
            <Link
              key={`${id}-${idx}`}
              href={`/watch?id=mal-${id}&type=anime&ep=1`} // default to ep 1 or the airing one if we can extract it
              className="flex items-center gap-3 bg-surface/30 hover:bg-surface p-2 rounded-lg border border-border/40 hover:border-accent-green/30 transition-colors group"
            >
              <div className="relative w-12 h-16 rounded overflow-hidden bg-surface shrink-0 border border-white/5">
                <Image src={poster} alt={title} fill className="object-cover group-hover:scale-105 transition-transform" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold text-accent-green tracking-wider uppercase block">
                  Episode {episode}
                </span>
                <p className="text-xs font-bold text-white line-clamp-2 group-hover:text-accent-green transition-colors mt-0.5">
                  {title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-text-secondary mt-1 font-medium">
                  {item.broadcast?.time || (item.airingAt ? new Date(item.airingAt * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Today')}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
