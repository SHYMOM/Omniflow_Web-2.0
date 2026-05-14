'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { searchHybrid } from '@/lib/api/hybrid';
import MediaGrid from '@/components/media/MediaGrid';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { useUserStore } from '@/store/userStore';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);
  const { settings } = useUserStore();
  const hideAdult = settings.hideAdult;

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery, hideAdult],
    queryFn: () => searchHybrid(debouncedQuery, 1, hideAdult),
    enabled: debouncedQuery.length > 1,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Discover</h1>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search anime, movies, manga..."
          className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-text-muted outline-none focus:border-accent-green transition-colors" autoFocus />
      </div>

      {/* Results */}
      {debouncedQuery.length > 1 && (
        <>
          <p className="text-sm text-text-secondary mb-4">
            {isLoading ? 'Searching...' : `Showing results for "${debouncedQuery}"`}
          </p>
          <MediaGrid items={searchResults || []} loading={isLoading} skeletonCount={12} />
          {!isLoading && searchResults?.length === 0 && (
            <p className="text-center text-text-muted py-12">No results found for &ldquo;{debouncedQuery}&rdquo;</p>
          )}
        </>
      )}

      {debouncedQuery.length <= 1 && (
        <p className="text-center text-text-muted py-12">Start typing to search...</p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><LoadingSpinner size={40} /></div>}><SearchContent /></Suspense>;
}
