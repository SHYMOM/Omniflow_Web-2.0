'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Bell, 
  Search, 
  Filter as FilterIcon, 
  ChevronDown, 
  ArrowUpDown, 
  Star, 
  Trash2,
  Bookmark
} from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils/cn';
import { formatScore } from '@/lib/utils/formatters';

const STATUS_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Planning', value: 'planning' },
  { label: 'Watching', value: 'watching' },
  { label: 'On hold', value: 'on_hold' },
  { label: 'Dropped', value: 'dropped' },
  { label: 'Finished', value: 'finished' },
  { label: 'Rewatching', value: 'rewatching' },
];

export default function WatchlistPage() {
  const router = useRouter();
  const { watchlist, removeFromWatchlist, updateWatchlistStatus } = useUserStore();
  
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'addedAt' | 'score' | 'title'>('addedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Filter items based on selected tab
  const filteredItems = useMemo(() => {
    return watchlist.filter(item => {
      if (activeTab === 'all') return true;
      // Map status or default it if missing
      const status = item.status || 'planning';
      return status === activeTab;
    });
  }, [watchlist, activeTab]);

  // Sort filtered items
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'addedAt') {
        comparison = new Date(a.addedAt || 0).getTime() - new Date(b.addedAt || 0).getTime();
      } else if (sortBy === 'score') {
        comparison = (a.score || 0) - (b.score || 0);
      } else if (sortBy === 'title') {
        const titleA = typeof a.title === 'string' ? a.title : 'Unknown';
        const titleB = typeof b.title === 'string' ? b.title : 'Unknown';
        comparison = titleA.localeCompare(titleB);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [filteredItems, sortBy, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20 text-white min-h-screen">
      {/* 1. Header Row (Back arrow + Title on left, Bell + Search on right) */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="p-1 rounded-full text-text-secondary hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display">Watchlist</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Notifications"
          >
            <Bell size={20} />
          </button>
          <Link 
            href="/search" 
            className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-all"
            aria-label="Search"
          >
            <Search size={20} />
          </Link>
        </div>
      </header>

      {/* 2. Category Tabs (Pills style) */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-3 mb-6 border-b border-border/20">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 text-xs md:text-sm font-medium tracking-wide whitespace-nowrap rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5",
              activeTab === tab.value
                ? "bg-white text-black font-semibold shadow-md"
                : "text-text-secondary hover:text-white bg-white/5 hover:bg-white/10"
            )}
          >
            {tab.label === 'All' && <Bookmark size={12} fill={activeTab === 'all' ? 'currentColor' : 'none'} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Action Controls Row (Filter, Sort dropdown, Sort order button) */}
      <div className="flex items-center justify-end gap-2 mb-6">
        {/* Filter Widget Button */}
        <button 
          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title="Filter List"
        >
          <FilterIcon size={16} />
        </button>

        {/* Sort By Dropdown Trigger */}
        <div className="relative">
          <button 
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="h-9 px-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center gap-2 text-xs md:text-sm text-text-secondary hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <span>Sort by: {sortBy === 'addedAt' ? 'Date Added' : sortBy === 'score' ? 'Rating' : 'Title'}</span>
            <ChevronDown size={14} className={cn("transition-transform", showSortMenu && "rotate-180")} />
          </button>

          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 mt-1.5 w-40 rounded-lg bg-surface border border-border p-1 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                {(['addedAt', 'score', 'title'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setSortBy(option);
                      setShowSortMenu(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs rounded-md transition-colors cursor-pointer",
                      sortBy === option 
                        ? "bg-accent-green/10 text-accent-green font-bold" 
                        : "text-text-secondary hover:text-white hover:bg-white/5"
                    )}
                  >
                    {option === 'addedAt' ? 'Date Added' : option === 'score' ? 'Rating' : 'Title'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sort Direction Toggle Button */}
        <button 
          onClick={toggleSortOrder}
          className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          title={sortOrder === 'desc' ? "Descending" : "Ascending"}
        >
          <ArrowUpDown size={16} className={cn("transition-transform", sortOrder === 'asc' && "rotate-180")} />
        </button>
      </div>

      {/* 4. Watchlist Content Section */}
      {sortedItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-300">
          <p className="text-text-secondary text-base font-medium tracking-wide">Nothing here yet :(</p>
          <p className="text-text-muted text-xs mt-1 max-w-xs">
            Start bookmarking entries to build your premium watchlist grid!
          </p>
          <Link 
            href="/discover" 
            className="mt-6 px-5 py-2.5 rounded-full bg-accent-green text-black text-xs font-bold hover:scale-105 transition-transform shadow-lg shadow-accent-green/20"
          >
            Explore Titles
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-in fade-in duration-300">
          {sortedItems.map((entry) => {
            const safeTitle = entry.title || 'Unknown Title';
            const cleanId = entry.mediaId.replace(/^(anilist-|tmdb-movie-|tmdb-tv-)/, '');
            const targetHref = `/${entry.mediaType}/${cleanId}`;
            const watchStatus = entry.status || 'planning';

            return (
              <div 
                key={entry.mediaId} 
                className="relative group flex flex-col bg-surface/40 border border-border/40 rounded-xl overflow-hidden hover:border-accent-green/30 hover:bg-surface/60 transition-all duration-300 hover:shadow-xl"
              >
                {/* Poster container */}
                <div className="relative aspect-[3/4] overflow-hidden bg-void">
                  <Link href={targetHref} className="block w-full h-full">
                    <Image 
                      src={entry.posterUrl} 
                      alt={safeTitle} 
                      fill 
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 180px"
                      className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  </Link>

                  {/* Rating Badge */}
                  {entry.score > 0 && (
                    <div className="absolute top-2 right-2 bg-void/90 backdrop-blur-md border border-white/10 text-white text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-md">
                      <Star size={10} className="text-accent-gold" fill="currentColor" />
                      {formatScore(entry.score)}
                    </div>
                  )}

                  {/* Delete button (top left overlay on hover) */}
                  <button 
                    onClick={() => removeFromWatchlist(entry.mediaId)} 
                    className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/80 text-text-secondary hover:text-accent-red hover:bg-black opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer border border-white/10"
                    title="Remove from Watchlist"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Info & Status Selector area */}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div className="min-w-0 mb-2">
                    <p className="text-[10px] text-accent-green font-bold uppercase tracking-wider mb-0.5">
                      {entry.formatLabel} • {entry.year}
                    </p>
                    <Link href={targetHref} className="text-xs md:text-sm font-bold text-white line-clamp-1 hover:text-accent-green transition-colors">
                      {safeTitle}
                    </Link>
                  </div>

                  {/* Interactive Status Modifiers Dropdown */}
                  <div className="relative">
                    <select
                      value={watchStatus}
                      onChange={(e) => updateWatchlistStatus(entry.mediaId, e.target.value)}
                      className={cn(
                        "w-full bg-void/80 border text-[11px] font-semibold px-2 py-1.5 rounded-lg outline-none cursor-pointer hover:bg-void transition-colors",
                        watchStatus === 'watching' && "border-accent-green/30 text-accent-green",
                        watchStatus === 'finished' && "border-white/20 text-white",
                        watchStatus === 'planning' && "border-white/10 text-text-secondary",
                        watchStatus === 'on_hold' && "border-accent-gold/30 text-accent-gold",
                        watchStatus === 'dropped' && "border-accent-red/30 text-accent-red",
                        watchStatus === 'rewatching' && "border-accent-green/30 text-accent-green"
                      )}
                    >
                      <option value="planning" className="bg-surface text-white">Planning</option>
                      <option value="watching" className="bg-surface text-white">Watching</option>
                      <option value="on_hold" className="bg-surface text-white">On Hold</option>
                      <option value="dropped" className="bg-surface text-white">Dropped</option>
                      <option value="finished" className="bg-surface text-white">Finished</option>
                      <option value="rewatching" className="bg-surface text-white">Rewatching</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
