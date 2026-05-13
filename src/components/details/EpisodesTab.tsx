'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Play, ChevronLeft, ChevronRight, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import type { AniListMedia } from '@/types/anilist';
import { getAnimeEpisodes } from '@/lib/api/jikan';
import { cn } from '@/lib/utils/cn';

interface EpisodesTabProps { media: AniListMedia; }

const EPISODES_PER_PAGE = 30;

export default function EpisodesTab({ media }: EpisodesTabProps) {
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortAsc, setSortAsc] = useState(true);
  const malId = media.idMal;

  const { data, isLoading } = useQuery({
    queryKey: ['anime', malId, 'episodes', page],
    queryFn: () => getAnimeEpisodes(malId!, page),
    enabled: !!malId,
  });

  const episodes = data?.data || [];
  const totalEps = data?.pagination?.items?.total || media.episodes || 0;
  const totalPages = Math.ceil(totalEps / EPISODES_PER_PAGE) || 1;
  const sorted = sortAsc ? episodes : [...episodes].reverse();
  const posterUrl = media.coverImage?.large || '';
  const rangeStart = (page - 1) * EPISODES_PER_PAGE + 1;
  const rangeEnd = Math.min(page * EPISODES_PER_PAGE, totalEps);

  return (
    <div className="pb-8">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-sm text-text-secondary">{totalEps} Episodes</span>
        <div className="flex items-center gap-2">
          {/* Pagination */}
          <div className="flex items-center gap-1 text-sm">
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded bg-surface border border-border text-text-secondary disabled:opacity-30">{'<<'}</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded bg-surface border border-border text-text-secondary disabled:opacity-30">{'<'}</button>
            <span className="px-3 py-1 text-white">{rangeStart} - {rangeEnd}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded bg-surface border border-border text-text-secondary disabled:opacity-30">{'>'}</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded bg-surface border border-border text-text-secondary disabled:opacity-30">{'>>'}</button>
          </div>
          {/* View toggle */}
          <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded', viewMode === 'grid' ? 'bg-accent-green/20 text-accent-green' : 'text-text-secondary')}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded', viewMode === 'list' ? 'bg-accent-green/20 text-accent-green' : 'text-text-secondary')}>
            <List size={16} />
          </button>
          <button onClick={() => setSortAsc(!sortAsc)} className="p-1.5 rounded text-text-secondary hover:text-white">
            <ArrowUpDown size={16} />
          </button>
        </div>
      </div>

      {/* Episodes grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse"><div className="aspect-video rounded-lg skeleton mb-2" /><div className="h-3 w-3/4 skeleton rounded" /></div>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {sorted.map((ep) => (
            <Link key={ep.mal_id} href={`/watch?id=${media.id}&type=anime&ep=${ep.mal_id}`} className="group">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-surface mb-1.5">
                <Image src={posterUrl} alt={ep.title} fill className="object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="absolute bottom-1 left-1 bg-accent-green text-black text-[11px] font-bold px-1.5 py-0.5 rounded">Ep {ep.mal_id}</span>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <Play size={24} className="text-white" fill="currentColor" />
                </div>
              </div>
              <p className="text-[13px] text-white line-clamp-2">{ep.title}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {sorted.map((ep) => (
            <Link key={ep.mal_id} href={`/watch?id=${media.id}&type=anime&ep=${ep.mal_id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface transition-colors group">
              <div className="relative w-[120px] h-[68px] rounded-lg overflow-hidden bg-surface shrink-0">
                <Image src={posterUrl} alt={ep.title} fill className="object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="absolute bottom-1 left-1 bg-accent-green text-black text-[10px] font-bold px-1 py-0.5 rounded">Ep {ep.mal_id}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white line-clamp-1">{ep.title}</p>
                {ep.aired && <p className="text-xs text-text-muted">{new Date(ep.aired).toLocaleDateString()}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
