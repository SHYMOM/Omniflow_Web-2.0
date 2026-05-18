'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, RefreshCw, Loader2 } from 'lucide-react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { searchHybrid, getHybridTrending } from '@/lib/api/hybrid';
import type { MediaItem } from '@/types/media';
import MediaGrid from '@/components/media/MediaGrid';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useUserStore } from '@/store/userStore';

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Slice of Life', 'Thriller'];
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export default function DiscoverPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 400);
  const { ref, inView } = useInView();

  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  const { settings } = useUserStore();
  const hideAdult = settings?.hideAdult ?? true;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch
  } = useInfiniteQuery({
    queryKey: ['discover', debouncedQuery, hideAdult],
    queryFn: ({ pageParam = 1 }) => 
      debouncedQuery.length >= 2 
        ? searchHybrid(debouncedQuery, pageParam, hideAdult)
        : getHybridTrending(pageParam, hideAdult),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => lastPage.length > 0 ? allPages.length + 1 : undefined,
  });

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, fetchNextPage, hasNextPage]);

  const allItems = useMemo(() => {
    return data?.pages.flat() || [];
  }, [data]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (selectedGenre !== 'all' && !item.genres?.some(g => g.toLowerCase() === selectedGenre.toLowerCase())) return false;
      if (selectedYear !== 'all' && item.year !== Number(selectedYear)) return false;
      return true;
    });
  }, [allItems, selectedType, selectedGenre, selectedYear]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Sidebar Filter Panel */}
        <div className="w-full lg:w-[260px] shrink-0 space-y-6 bg-surface border border-border p-5 rounded-xl h-fit">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Filter size={18} className="text-accent-green" /> Filters
            </h2>
            <button
              onClick={() => {
                setSelectedType('all');
                setSelectedGenre('all');
                setSelectedYear('all');
                setSearchQuery('');
              }}
              className="text-xs text-text-secondary hover:text-white transition-colors"
              title="Reset Filters"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Title / Keyword</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search titles..."
                className="w-full bg-void border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-muted outline-none focus:border-accent-green transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Media Type</label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="w-full bg-void border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors cursor-pointer"
            >
              <option value="all">All Formats</option>
              <option value="anime">Anime</option>
              <option value="movie">Movies</option>
              <option value="tv">TV Shows</option>
              <option value="manga">Manga</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Genre</label>
            <select
              value={selectedGenre}
              onChange={e => setSelectedGenre(e.target.value)}
              className="w-full bg-void border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors cursor-pointer"
            >
              <option value="all">All Genres</option>
              {GENRES.map(g => (
                <option key={g} value={g.toLowerCase()}>{g}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">Release Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="w-full bg-void border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors cursor-pointer"
            >
              <option value="all">All Years</option>
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white font-display">Advanced Discovery</h1>
              <p className="text-xs text-text-secondary mt-1">
                {status === 'pending' ? 'Aggregating hybrid database...' : `Showing ${filteredItems.length} matching cinematic entries`}
              </p>
            </div>
          </div>

          <MediaGrid items={filteredItems} loading={status === 'pending'} skeletonCount={12} />

          <div ref={ref} className="py-8 flex justify-center">
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-accent-green animate-pulse">
                <Loader2 className="animate-spin" />
                <span className="text-sm font-medium">Loading more...</span>
              </div>
            )}
          </div>

          {status === 'success' && filteredItems.length === 0 && (
            <div className="text-center py-20 border border-dashed border-border rounded-xl">
              <p className="text-sm text-text-muted">No media entries match your custom filter combinations.</p>
              <button
                onClick={() => {
                  setSelectedType('all');
                  setSelectedGenre('all');
                  setSelectedYear('all');
                  setSearchQuery('');
                }}
                className="mt-3 text-xs text-accent-green font-bold underline cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
