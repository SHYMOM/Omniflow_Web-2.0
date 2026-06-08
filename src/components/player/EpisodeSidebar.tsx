'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, RefreshCw, ArrowUpDown, LayoutList, Bell } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { getMediaEpisodes } from '@/lib/api/hybrid';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface Episode {
  number: number;
  title: string;
  thumbnail: string | null;
  aired?: string | null;
  filler?: boolean;
}

interface EpisodeSidebarProps {
  mediaId: string;
  mediaType: string;
  currentEp: number;
  totalEpisodes: number;
  title: string;
  nextAiringEpisode?: {
    episode: number;
    timeUntilAiring: number;
    airingAt: number;
  };
  recommendations?: Array<{
    id: string;
    title: string;
    posterUrl: string;
    type: string;
    formatLabel?: string;
  }>;
}

export default function EpisodeSidebar({ mediaId, mediaType, currentEp, totalEpisodes, title, nextAiringEpisode, recommendations = [] }: EpisodeSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDesc, setIsDesc] = useState(false);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getMediaEpisodes(mediaId, mediaType);
        setEpisodes(data);
      } catch (err) {
        console.error('Failed to load episodes', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mediaId, mediaType]);

  // Determine the maximum episode number we should display
  const maxEpToShow = useMemo(() => {
    let max = currentEp;
    
    // Check totalEpisodes prop
    if (totalEpisodes && totalEpisodes > max) {
      max = totalEpisodes;
    }
    
    // Check if nextAiringEpisode exists
    if (nextAiringEpisode?.episode && (nextAiringEpisode.episode - 1) > max) {
      max = nextAiringEpisode.episode - 1;
    }
    
    // Check if any episode in the list is higher
    if (episodes.length > 0) {
      const highestInList = Math.max(...episodes.map(e => e.number));
      if (highestInList > max) {
        max = highestInList;
      }
    }
    
    return max;
  }, [currentEp, totalEpisodes, nextAiringEpisode, episodes]);

  // Pad the episodes list so that all episodes from 1 to maxEpToShow are present
  const paddedEpisodes = useMemo(() => {
    if (maxEpToShow <= 0) return episodes;
    
    const epMap = new Map<number, Episode>();
    episodes.forEach(ep => {
      epMap.set(ep.number, ep);
    });
    
    const result: Episode[] = [];
    for (let i = 1; i <= maxEpToShow; i++) {
      if (epMap.has(i)) {
        result.push(epMap.get(i)!);
      } else {
        result.push({
          number: i,
          title: `Episode ${i}`,
          thumbnail: null,
          aired: null
        });
      }
    }
    return result;
  }, [episodes, maxEpToShow]);

  // Apply search query filter and order reverse toggle
  const filteredEpisodes = useMemo(() => {
    let list = paddedEpisodes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        ep =>
          ep.title.toLowerCase().includes(q) ||
          `episode ${ep.number}`.includes(q) ||
          `${ep.number}` === q
      );
    }
    return isDesc ? [...list].reverse() : list;
  }, [paddedEpisodes, searchQuery, isDesc]);

  // Compute Up Next target title string
  const nextEpObj = paddedEpisodes.find(e => e.number === currentEp + 1) || paddedEpisodes[0];

  return (
    <div className="w-full lg:w-[360px] shrink-0 space-y-4">
      {/* Up Next & Episodes Portal Box */}
      <div className="bg-void rounded-xl border border-border overflow-hidden shadow-lg">
        {/* Top Header String Info */}
        <div className="p-3.5 bg-surface/40 border-b border-border flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              Up Next - {nextEpObj?.title || `Episode ${currentEp + 1}`}
            </p>
            <p className="text-[11px] text-text-muted truncate mt-0.5 font-medium">
              Playing - Episode {currentEp} - {title || 'Stream'}
            </p>
          </div>
          <button className="text-text-muted hover:text-white transition-colors cursor-pointer shrink-0 ml-2">
            <span className="text-xs">▲</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 bg-surface/20 border-b border-border flex items-center gap-2">
          {/* Internal search filter */}
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Episode"
              className="w-full bg-void border border-border/80 rounded-md pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-text-muted outline-none focus:border-accent-green transition-colors"
            />
          </div>

          {/* Auxiliary action triggers */}
          <button
            onClick={() => setSearchQuery('')}
            className="w-7 h-7 rounded-md bg-void border border-border flex items-center justify-center text-text-secondary hover:text-white hover:bg-surface transition-colors cursor-pointer shrink-0"
            title="Reset Filters"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setIsDesc(!isDesc)}
            className={cn(
              "w-7 h-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0",
              isDesc ? "bg-accent-green/20 border-accent-green text-accent-green" : "bg-void border-border text-text-secondary hover:text-white hover:bg-surface"
            )}
            title="Sort List Direction"
          >
            <ArrowUpDown size={13} />
          </button>
          <button
            className="w-7 h-7 rounded-md bg-void border border-border flex items-center justify-center text-text-secondary hover:text-white hover:bg-surface transition-colors cursor-pointer shrink-0"
            title="Toggle Visual Density Layout"
          >
            <LayoutList size={13} />
          </button>
        </div>

        {/* Episode Stream Scroller */}
        <div className="max-h-[380px] overflow-y-auto hide-scrollbar divide-y divide-border/30">
          {loading ? (
            <div className="py-10 flex justify-center">
              <LoadingSpinner size={24} />
            </div>
          ) : filteredEpisodes.map((ep) => {
            const isPlaying = ep.number === currentEp;

            return (
              <Link
                key={ep.number}
                href={`/watch?id=${mediaId}&type=${mediaType}&ep=${ep.number}`}
                className={cn(
                  'flex gap-3 p-2.5 transition-all items-start group relative',
                  isPlaying
                    ? 'bg-white/10 border-l-2 border-accent-green'
                    : 'hover:bg-surface/50'
                )}
              >
                {/* Thumbnail image with embedded Ep tag capsule */}
                <div className="relative w-[110px] aspect-video rounded-md overflow-hidden bg-surface shrink-0 border border-white/5 group-hover:border-accent-green/40 transition-colors">
                  {ep.thumbnail ? (
                    <Image src={ep.thumbnail} alt={ep.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-hover text-[10px] text-text-muted font-bold uppercase">
                      No Preview
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />

                  {/* Absolute Bottom-Left Tag Capsule */}
                  <span className="absolute bottom-1 left-1 bg-void/90 backdrop-blur-sm text-white font-bold text-[10px] px-1.5 py-0.5 rounded border border-white/10">
                    Ep {ep.number}
                  </span>
                  {ep.filler && (
                    <span className="absolute top-1 right-1 bg-yellow-500 text-black font-bold text-[8px] px-1 rounded uppercase">
                      Filler
                    </span>
                  )}
                </div>

                {/* Right text stack */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-bold line-clamp-2 leading-snug transition-colors",
                    isPlaying ? "text-accent-green" : "text-white group-hover:text-accent-green"
                  )}>
                    {ep.title}
                  </p>
                  <p className="text-[10px] text-text-muted mt-1 font-medium">
                    {ep.aired ? new Date(ep.aired).toLocaleDateString() : 'Date TBD'}
                  </p>
                </div>
              </Link>
            );
          })}

          {!loading && filteredEpisodes.length === 0 && (
            <p className="text-center text-xs text-text-muted py-10">No broadcast entries match query</p>
          )}
        </div>

        {/* Countdown Alert Strip Bottom */}
        {nextAiringEpisode && (
          <div className="p-2.5 bg-void border-t border-border flex items-center justify-center gap-1.5 text-center">
            <Bell size={12} className="text-text-muted" />
            <span className="text-xs font-bold text-text-secondary">Next ep {nextAiringEpisode.episode} airing</span>
            <span className="text-xs font-bold text-accent-green">
              {nextAiringEpisode.timeUntilAiring 
                ? `in ${Math.floor(nextAiringEpisode.timeUntilAiring / 86400)}d ${Math.floor((nextAiringEpisode.timeUntilAiring % 86400) / 3600)}h` 
                : 'soon'}
            </span>
          </div>
        )}
      </div>

      {/* More Like This (Recommendations) Block */}
      {recommendations.length > 0 && (
        <div className="pt-4 space-y-3">
          <h3 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider px-1">More Like This</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-3 gap-3">
            {recommendations.slice(0, 6).map((rec) => (
              <Link key={rec.id} href={`/${rec.type}/${rec.id}`} className="group">
                <div className="relative aspect-[3/4] rounded-md overflow-hidden bg-surface mb-1.5 border border-border/30 group-hover:border-accent-green/50 transition-all">
                  <Image src={rec.posterUrl} alt={rec.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                </div>
                <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter truncate">{rec.formatLabel}</p>
                <p className="text-[10px] text-white font-bold line-clamp-1 group-hover:text-accent-green transition-colors leading-tight">{rec.title}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
