'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, ChevronRight, Settings, Maximize2, 
  Menu, Info, Download, Share2, Layout, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { getMangaDetail } from '@/lib/api/anilist';
import { extractId } from '@/lib/api/hybrid';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils/cn';

type ReaderMode = 'vertical' | 'paged';

export default function MangaReaderPage() {
  const params = useParams();
  const router = useRouter();
  const mangaId = extractId(params.id as string);
  const chapterNum = Number(params.chapter);

  const [readerMode, setReaderMode] = useState<ReaderMode>('vertical');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(24); // Mocked for now
  const [controlsVisible, setControlsVisible] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Mocked pages URLs - In a real app, these would come from an API (MangaDex, etc.)
  const pages = Array.from({ length: totalPages }).map((_, i) => 
    `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60`
  );

  const { data: manga, isLoading } = useQuery({
    queryKey: ['manga', mangaId],
    queryFn: () => getMangaDetail(mangaId),
    enabled: !!mangaId,
  });

  const toggleControls = useCallback(() => setControlsVisible(prev => !prev), []);

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNextPage();
      if (e.key === 'ArrowLeft') handlePrevPage();
      if (e.key === 'm') setReaderMode(prev => prev === 'vertical' ? 'paged' : 'vertical');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, readerMode]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-void"><LoadingSpinner size={40} /></div>;

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
              <p className="text-[11px] text-text-secondary">Chapter {chapterNum}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex bg-surface border border-border rounded-lg p-1">
              <button 
                onClick={() => setReaderMode('vertical')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", readerMode === 'vertical' ? "bg-white text-black" : "text-text-secondary hover:text-white")}
              >
                Vertical
              </button>
              <button 
                onClick={() => setReaderMode('paged')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", readerMode === 'paged' ? "bg-white text-black" : "text-text-secondary hover:text-white")}
              >
                Paged
              </button>
            </div>
            <button className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white"><Settings size={18} /></button>
          </div>
        </div>
      </div>

      {/* Reader Area */}
      <main 
        className={cn(
          "pt-16 pb-20 transition-all cursor-pointer",
          readerMode === 'vertical' ? "max-w-[800px] mx-auto space-y-2" : "flex flex-col items-center justify-center min-h-[calc(100vh-140px)]"
        )}
        onClick={toggleControls}
      >
        {readerMode === 'vertical' ? (
          pages.map((url, i) => (
            <div key={i} className="relative w-full min-h-[600px] bg-surface flex items-center justify-center">
              <img src={url} alt={`Page ${i + 1}`} className="w-full h-auto" loading="lazy" />
              <div className="absolute bottom-4 right-4 bg-black/60 text-white text-[10px] px-2 py-1 rounded">Page {i + 1}</div>
            </div>
          ))
        ) : (
          <div className="relative group max-w-full h-full flex items-center justify-center">
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrevPage(); }}
              className="absolute left-4 z-20 p-4 bg-black/40 hover:bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={32} />
            </button>
            <img 
              src={pages[currentPage - 1]} 
              alt={`Page ${currentPage}`} 
              className="max-h-[85vh] w-auto shadow-2xl transition-all"
              style={{ transform: `scale(${zoomLevel / 100})` }}
            />
            <button 
              onClick={(e) => { e.stopPropagation(); handleNextPage(); }}
              className="absolute right-4 z-20 p-4 bg-black/40 hover:bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={32} />
            </button>
          </div>
        )}
      </main>

      {/* Bottom Navigation (Paged mode only) */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10 p-3 transition-transform duration-300",
        (!controlsVisible || readerMode === 'vertical') && "translate-y-full"
      )}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-center gap-6">
          <span className="text-xs font-medium text-text-secondary">
            Page <span className="text-white">{currentPage}</span> / {totalPages}
          </span>
          <div className="w-64 h-1.5 bg-surface rounded-full relative overflow-hidden">
            <div 
              className="absolute h-full bg-white transition-all duration-300" 
              style={{ width: `${(currentPage / totalPages) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
