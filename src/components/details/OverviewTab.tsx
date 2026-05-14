'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { MediaItem } from '@/types/media';
import { formatDate, formatScore, formatSeason } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { Maximize2, X } from 'lucide-react';
import Portal from '@/components/ui/Portal';
import { motion, AnimatePresence } from 'framer-motion';

interface OverviewTabProps { media: MediaItem; }

export default function OverviewTab({ media }: OverviewTabProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllCharacters, setShowAllCharacters] = useState(false);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [isTrailerFullscreen, setIsTrailerFullscreen] = useState(false);

  const score = media.score || 0;
  const meanScore = media.meanScore || 0;
  
  const allCharacters = media.characters || [];
  const displayCharacters = showAllCharacters ? allCharacters : allCharacters.slice(0, 8);
  
  const allStaff = media.staff || [];
  const displayStaff = showAllStaff ? allStaff : allStaff.slice(0, 6);

  const trailerYoutubeId = media.trailerYoutubeId;

  const infoRows = [
    { label: 'Start', value: media.startDate ? formatDate(undefined, media.startDate) : '?' },
    { label: 'Season', value: formatSeason(media.season as any, media.seasonYear) },
    { label: 'Status', value: media.status || '?', isGreen: media.status === 'RELEASING' },
    { label: 'Mean Score', value: String(meanScore) },
    { label: 'Source', value: (media.sourceMedia || '?').replace(/_/g, ' ') },
    { label: 'Country', value: media.countryOfOrigin || '?' },
    ...(media.hashtag ? [{ label: 'Hashtag', value: media.hashtag }] : []),
    ...(media.nativeTitle ? [{ label: 'Native Title', value: media.nativeTitle }] : []),
    ...(media.synonyms?.length ? [{ label: 'Synonyms', value: media.synonyms.join(', ') }] : []),
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Expandable Clamped Description Block */}
      {media.description && (
        <div className="bg-surface/30 p-4 rounded-xl border border-border">
          <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Synopsis</h3>
          <p className={cn(
            "text-xs md:text-sm text-text-secondary leading-relaxed transition-all",
            !isExpanded && "line-clamp-3"
          )}>
            {media.description.replace(/<[^>]*>/g, '')}
          </p>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-accent-green hover:underline mt-2 block select-none cursor-pointer"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Average Score', value: formatScore(score) },
          { label: 'Type', value: media.format || '?' },
          { label: 'Duration', value: media.duration || '?' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface rounded-lg p-4 text-center border border-border">
            <p className="text-xs text-text-secondary mb-1">{label}</p>
            <p className="text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Info table */}
      <div className="rounded-lg overflow-hidden border border-border">
        {infoRows.map(({ label, value, isGreen }, i) => (
          <div key={label} className={`flex px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-surface' : 'bg-void'}`}>
            <span className="text-text-secondary w-32 shrink-0">{label}</span>
            <span className={isGreen ? 'text-accent-green' : 'text-white'}>{value}</span>
          </div>
        ))}
      </div>

      {/* Trailer */}
      {trailerYoutubeId && (
        <div className="relative">
          <h3 className="text-base font-semibold text-white mb-3">Trailer</h3>
          <div className="relative group max-w-md aspect-video rounded-xl overflow-hidden bg-surface border border-border">
            <iframe 
              src={`https://www.youtube.com/embed/${trailerYoutubeId}?controls=1&modestbranding=1&rel=0&iv_load_policy=3&enablejsapi=1`} 
              title="Trailer" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen 
              className="w-full h-full" 
            />
            {/* Custom Fullscreen Trigger Overlay (top right) */}
            <button 
              onClick={() => setIsTrailerFullscreen(true)}
              className="absolute top-3 right-3 p-2.5 bg-black/70 hover:bg-black/90 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer shadow-xl border border-white/10"
              title="Fullscreen Mode"
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Trailer Modal */}
      <AnimatePresence>
        {isTrailerFullscreen && (
          <Portal>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 md:p-10"
            >
              <button 
                onClick={() => setIsTrailerFullscreen(false)}
                className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-[1001] cursor-pointer"
              >
                <X size={24} />
              </button>
              <div className="w-full h-full max-w-6xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-void">
                <iframe 
                  src={`https://www.youtube.com/embed/${trailerYoutubeId}?autoplay=1&controls=1&modestbranding=1&rel=0`} 
                  title="Trailer Fullscreen" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen 
                  className="w-full h-full" 
                />
              </div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* Studios */}
      {media.studios?.nodes?.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Studios</h3>
          <div className="flex flex-wrap gap-2">
            {media.studios.nodes.map((s) => (
              <span key={s.id} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{s.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Genres */}
      {media.genres?.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Genres</h3>
          <div className="flex flex-wrap gap-2">
            {media.genres.map((g) => (
              <span key={g} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{g}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {media.tags?.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {media.tags.filter(t => !t.isMediaSpoiler).slice(0, 15).map((t) => (
              <span key={t.id} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{t.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Characters */}
      {allCharacters.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-white">Characters</h3>
            {allCharacters.length > 8 && (
              <button 
                onClick={() => setShowAllCharacters(!showAllCharacters)}
                className="text-xs font-bold text-accent-green hover:underline cursor-pointer"
              >
                {showAllCharacters ? 'Show Less' : `View All (${allCharacters.length})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {displayCharacters.map((char) => (
              <div key={char.id} className="flex items-center justify-between bg-surface rounded-lg p-3 border border-border">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-void shrink-0">
                    <Image src={char.image} alt={char.name} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">{char.name}</p>
                    <p className="text-xs text-text-secondary">{char.role}</p>
                  </div>
                </div>
                {char.voiceActor && (
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm text-white">{char.voiceActor.name}</p>
                      <p className="text-xs text-text-secondary">{char.voiceActor.language}</p>
                    </div>
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-void shrink-0">
                      <Image src={char.voiceActor.image} alt={char.voiceActor.name} fill className="object-cover" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff */}
      {allStaff.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-white">Staff</h3>
            {allStaff.length > 6 && (
              <button 
                onClick={() => setShowAllStaff(!showAllStaff)}
                className="text-xs font-bold text-accent-green hover:underline cursor-pointer"
              >
                {showAllStaff ? 'Show Less' : `View All (${allStaff.length})`}
              </button>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {displayStaff.map((s) => (
              <div key={s.id} className="shrink-0 w-[100px] text-center">
                <div className="relative w-20 h-24 rounded-lg overflow-hidden bg-surface mx-auto mb-2">
                   <Image src={s.image} alt={s.name} fill className="object-cover" />
                </div>
                <p className="text-[10px] text-accent-green font-bold uppercase tracking-tighter mb-0.5 line-clamp-1">{s.role}</p>
                <p className="text-xs text-white font-medium line-clamp-1">{s.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
