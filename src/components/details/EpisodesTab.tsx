'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Play, ChevronLeft, ChevronRight, LayoutGrid, List, ArrowUpDown, Clock } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import type { MediaItem } from '@/types/media';
import { fetchMediaEpisodesAction } from '@/lib/actions/episodes';
import { cn } from '@/lib/utils/cn';

interface EpisodesTabProps { media: MediaItem; rawMedia: AniListMedia; }

const EPISODES_PER_PAGE = 24;

export default function EpisodesTab({ media }: EpisodesTabProps) {
  const [page, setPage] = useState(1);
  const [sortAsc, setSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDesc, setIsDesc] = useState(false);
  const router = useRouter();

  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ['episodes', media.id],
    queryFn: () => fetchMediaEpisodesAction(String(media.id), media.type || 'anime'),
    enabled: !!media.id,
  });

  const totalEps = episodes?.length || 0;
  const totalPages = Math.ceil(totalEps / EPISODES_PER_PAGE) || 1;
  const currentEps = episodes?.slice((page - 1) * EPISODES_PER_PAGE, page * EPISODES_PER_PAGE) || [];
  const sorted = sortAsc ? currentEps : [...currentEps].reverse();
  const posterUrl = media.posterUrl || '';

  const rangeStart = (page - 1) * EPISODES_PER_PAGE + 1;
  const rangeEnd = Math.min(page * EPISODES_PER_PAGE, totalEps);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-video bg-surface rounded-xl border border-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-white font-display">Episodes</h2>
          <span className="text-xs text-text-secondary bg-surface px-2 py-0.5 rounded border border-border">{totalEps} Total</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 bg-surface/50 border border-border rounded-lg p-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-surface text-white disabled:opacity-30 cursor-pointer transition-colors"><ChevronLeft size={16} /></button>
              <span className="text-xs font-bold text-white px-2">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-md hover:bg-surface text-white disabled:opacity-30 cursor-pointer transition-colors"><ChevronRight size={16} /></button>
            </div>
          )}
          
          <button onClick={() => setSortAsc(!sortAsc)} className="flex items-center gap-2 text-xs font-bold text-text-secondary hover:text-accent-green transition-colors bg-surface/50 border border-border px-3 py-2 rounded-lg">
            <ArrowUpDown size={14} /> {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sorted.map((ep: any) => (
          <Link 
            key={ep.number} 
            href={`/watch?id=${media.id}&type=${media.type}&ep=${ep.number}`} 
            className="group block"
          >
            <div className="relative aspect-video rounded-xl overflow-hidden bg-surface mb-2.5 border border-white/5 group-hover:border-accent-green/40 transition-all shadow-lg">
              {ep.thumbnail ? (
                <Image src={ep.thumbnail} alt={ep.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-void">
                  <Image src={posterUrl} alt="" fill className="object-cover opacity-20 blur-sm" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  <span className="relative z-10 text-[10px] text-text-muted font-black uppercase tracking-widest">No Preview</span>
                </div>
              )}
              
              {/* Overlay and Badge */}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
              <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md text-white text-[9px] font-black px-1.5 py-0.5 rounded border border-white/10">
                EP {ep.number}
              </div>
              
              {/* Play Icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                <div className="w-12 h-12 rounded-full bg-accent-green flex items-center justify-center text-black shadow-[0_0_20px_rgba(168,255,53,0.5)]">
                  <Play size={24} fill="currentColor" />
                </div>
              </div>
            </div>
            
            <div className="min-w-0">
              <p className="text-sm font-bold text-white line-clamp-1 group-hover:text-accent-green transition-colors leading-snug">
                {ep.title}
              </p>
              {ep.aired && (
                <div className="flex items-center gap-1.5 mt-1 text-text-muted">
                  <Clock size={10} />
                  <span className="text-[10px] font-medium uppercase tracking-tighter">{new Date(ep.aired).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {totalEps === 0 && (
        <div className="text-center py-20 bg-surface/20 rounded-2xl border border-dashed border-border">
          <p className="text-text-muted text-sm italic">Episodes data currently unavailable.</p>
        </div>
      )}
    </div>
  );
}
