'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, TrendingUp, Film, Tv, BookOpen } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useQuery } from '@tanstack/react-query';
import { searchHybrid } from '@/lib/api/hybrid';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useUserStore } from '@/store/userStore';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

export default function QuickSearch() {
  const router = useRouter();
  const { searchModalOpen, setSearchModalOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  const { settings } = useUserStore();
  const hideAdult = settings.hideAdult;

  const { data: results, isLoading } = useQuery({
    queryKey: ['quick-search', debouncedQuery, hideAdult],
    queryFn: () => searchHybrid(debouncedQuery, 1, hideAdult),
    enabled: debouncedQuery.length > 1,
  });

  useEffect(() => {
    if (searchModalOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [searchModalOpen]);

  // Handle keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchModalOpen]);

  const handleSelect = (id: string, type: string) => {
    setSearchModalOpen(false);
    const base = type === 'manga' ? 'manga' : type === 'movie' ? 'movies' : type === 'tv' ? 'tv' : 'anime';
    router.push(`/${base}/${id}`);
  };

  const handleSearchAll = () => {
    if (query.trim()) {
      setSearchModalOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <AnimatePresence>
      {searchModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSearchModalOpen(false)}
            className="absolute inset-0 bg-void/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[70vh]"
          >
            {/* Search Input Area */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-surface-hover">
              <Search className="text-text-muted shrink-0" size={20} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search for anything..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchAll()}
                className="flex-1 bg-transparent border-none outline-none text-base text-white placeholder:text-text-muted"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 hover:bg-surface rounded-full text-text-muted hover:text-white transition-colors">
                  <X size={16} />
                </button>
              )}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-void border border-border text-[10px] font-bold text-text-muted">
                ESC
              </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              {!query ? (
                <div className="py-8 px-4 text-center">
                  <TrendingUp className="mx-auto text-accent-green mb-3" size={32} />
                  <h3 className="text-sm font-bold text-white">What are you looking for?</h3>
                  <p className="text-xs text-text-muted mt-1">Search for your favorite anime, movies, or manga titles.</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-8">
                    {[
                      { label: 'Anime', icon: Tv, color: 'text-accent-green' },
                      { label: 'Movies', icon: Film, color: 'text-blue-400' },
                      { label: 'TV Shows', icon: Tv, color: 'text-purple-400' },
                      { label: 'Manga', icon: BookOpen, color: 'text-orange-400' },
                    ].map((cat) => (
                      <button key={cat.label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-hover border border-border/50 hover:border-accent-green/50 transition-all group">
                        <cat.icon size={20} className={cn(cat.color, "group-hover:scale-110 transition-transform")} />
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : isLoading ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-text-muted font-medium">Scanning the multiverse...</p>
                </div>
              ) : results && results.length > 0 ? (
                <div className="space-y-1">
                  {results.slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.id, item.type)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-hover transition-colors group text-left"
                    >
                      <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-surface shrink-0 border border-white/5">
                        {item.posterUrl && <Image src={item.posterUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                            item.type === 'manga' ? "bg-orange-500/20 text-orange-400" : "bg-accent-green/20 text-accent-green"
                          )}>
                            {item.type}
                          </span>
                          {item.year && <span className="text-[10px] text-text-muted">{item.year}</span>}
                        </div>
                        <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-accent-green transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-xs text-text-secondary line-clamp-1 mt-0.5 font-medium">
                          {item.genres?.slice(0, 3).join(', ')}
                        </p>
                      </div>
                      <X className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" size={14} />
                    </button>
                  ))}
                  
                  {results.length > 8 && (
                    <button
                      onClick={handleSearchAll}
                      className="w-full py-3 text-center text-xs font-bold text-accent-green hover:underline border-t border-border mt-2"
                    >
                      View all {results.length} results →
                    </button>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm text-text-muted italic">No matches found for &ldquo;{query}&rdquo;</p>
                </div>
              )}
            </div>

            {/* Footer / Tip */}
            <div className="px-4 py-3 bg-void/50 border-t border-border flex items-center justify-between text-[10px] font-medium text-text-muted">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><Clock size={12} /> Recent Searches</span>
              </div>
              <span>Tip: Use ⌘K to open search anytime</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
