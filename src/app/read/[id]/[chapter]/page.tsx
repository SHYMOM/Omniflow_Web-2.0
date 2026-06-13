'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, ChevronRight, Settings, 
  ArrowLeft, BookOpen, Layers
} from 'lucide-react';
import Link from 'next/link';
import { getMangaDetail } from '@/lib/api/anilist';
import { extractId } from '@/lib/api/hybrid';
import { fetchMangaChapterPagesAction } from '@/lib/actions/manga';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils/cn';

type ReaderMode = 'vertical' | 'paged';

function MangaReaderContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mangaId = extractId(params.id as string);
  const chapterId = decodeURIComponent(params.chapter as string);
  const chapterNum = searchParams.get('num') || '?';
  const providerName = searchParams.get('provider') || undefined;

  const [readerMode, setReaderMode] = useState<ReaderMode>('vertical');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  const { data: manga, isLoading: mangaLoading } = useQuery({
    queryKey: ['manga', mangaId],
    queryFn: () => getMangaDetail(String(mangaId)),
    enabled: !!mangaId,
  });

  const { data: fetchedPages, isLoading: pagesLoading, error: pagesError } = useQuery({
    queryKey: ['manga-pages', chapterId, providerName],
    queryFn: () => fetchMangaChapterPagesAction(chapterId, providerName),
    enabled: !!chapterId,
    retry: 1,
  });

  const pages = fetchedPages && fetchedPages.length > 0 ? fetchedPages : [];

  useEffect(() => {
    if (pages.length > 0) {
      setTotalPages(pages.length);
    }
  }, [pages.length]);

  const toggleControls = useCallback(() => setControlsVisible(prev => !prev), []);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  }, [currentPage, totalPages]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  }, [currentPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextPage();
      if (e.key === 'ArrowLeft') handlePrevPage();
      if (e.key === 'm') setReaderMode(prev => prev === 'vertical' ? 'paged' : 'vertical');
      if (e.key === 'Escape') setControlsVisible(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextPage, handlePrevPage]);

  if (mangaLoading || pagesLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-void gap-3">
        <LoadingSpinner size={40} />
        <p className="text-text-secondary text-sm">Loading chapter pages...</p>
      </div>
    );
  }

  if (pagesError || pages.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-void gap-4">
        <BookOpen size={48} className="text-text-secondary opacity-50" />
        <p className="text-white font-medium">Could not load chapter pages</p>
        <p className="text-text-secondary text-sm max-w-md text-center">
          The reading provider may be temporarily unavailable or this chapter might not be available in English.
        </p>
        <div className="flex gap-3 mt-2">
          <Link
            href={`/manga/${mangaId}`}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm text-white hover:bg-surface-hover transition-colors"
          >
            Back to Details
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-black font-medium rounded-lg text-sm hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* Top Controls Bar */}
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10 p-3 transition-transform duration-300",
        !controlsVisible && "-translate-y-full"
      )}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/manga/${mangaId}`} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate max-w-[200px] md:max-w-md">{manga?.title?.english || manga?.title?.romaji}</h1>
              <p className="text-[11px] text-text-secondary">Chapter {chapterNum} · {pages.length} pages</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex bg-surface border border-border rounded-lg p-1">
              <button 
                onClick={() => setReaderMode('vertical')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer", readerMode === 'vertical' ? "bg-white text-black" : "text-text-secondary hover:text-white")}
              >
                <Layers size={14} className="inline mr-1" /> Vertical
              </button>
              <button 
                onClick={() => setReaderMode('paged')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer", readerMode === 'paged' ? "bg-white text-black" : "text-text-secondary hover:text-white")}
              >
                <BookOpen size={14} className="inline mr-1" /> Paged
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reader Area */}
      <main 
        className={cn(
          "pt-16 pb-20 transition-all cursor-pointer",
          readerMode === 'vertical' ? "max-w-[800px] mx-auto space-y-0" : "flex flex-col items-center justify-center min-h-[calc(100vh-140px)]"
        )}
        onClick={toggleControls}
      >
        {readerMode === 'vertical' ? (
          pages.map((url: string, i: number) => (
            <div key={i} className="relative w-full flex items-center justify-center bg-[#111]">
              <img 
                src={url} 
                alt={`Page ${i + 1}`} 
                className="w-full h-auto select-none" 
                loading={i < 3 ? 'eager' : 'lazy'} 
                referrerPolicy="no-referrer"
                draggable={false}
              />
            </div>
          ))
        ) : (
          <div className="relative group max-w-full h-full flex items-center justify-center px-16">
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrevPage(); }}
              disabled={currentPage <= 1}
              className="absolute left-2 z-20 p-4 bg-black/40 hover:bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 cursor-pointer"
            >
              <ChevronLeft size={32} />
            </button>
            <img 
              src={pages[currentPage - 1]} 
              alt={`Page ${currentPage}`} 
              className="max-h-[85vh] w-auto shadow-2xl transition-all select-none"
              style={{ transform: `scale(${zoomLevel / 100})` }}
              referrerPolicy="no-referrer"
              draggable={false}
            />
            <button 
              onClick={(e) => { e.stopPropagation(); handleNextPage(); }}
              disabled={currentPage >= totalPages}
              className="absolute right-2 z-20 p-4 bg-black/40 hover:bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0 cursor-pointer"
            >
              <ChevronRight size={32} />
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10 p-3 transition-transform duration-300",
        !controlsVisible && "translate-y-full"
      )}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-6">
          <span className="text-xs font-medium text-text-secondary">
            {readerMode === 'paged' ? (
              <>Page <span className="text-white">{currentPage}</span> / {totalPages}</>
            ) : (
              <>{totalPages} pages · Scroll to read</>
            )}
          </span>
          {readerMode === 'paged' && totalPages > 0 && (
            <div className="w-64 h-1.5 bg-surface rounded-full relative overflow-hidden">
              <div 
                className="absolute h-full bg-white rounded-full transition-all duration-300" 
                style={{ width: `${(currentPage / totalPages) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MangaReaderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-void"><LoadingSpinner size={40} /></div>}>
      <MangaReaderContent />
    </Suspense>
  );
}
