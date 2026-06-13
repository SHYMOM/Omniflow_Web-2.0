'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  BookOpen, Bookmark, Share2, ArrowLeft, Star, Calendar,
  Layers, ChevronDown, ChevronUp, Search, ExternalLink
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMangaDetail } from '@/lib/api/anilist';
import { extractId, mapAniListToMediaItem } from '@/lib/api/hybrid';
import { fetchMangaChaptersAction } from '@/lib/actions/manga';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TypeBadge from '@/components/media/TypeBadge';
import { formatDate, formatScore } from '@/lib/utils/formatters';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils/cn';
import type { MangaChapter } from '@/lib/api/manga-aggregator';

export default function MangaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = extractId(params.id as string);
  const [activeTab, setActiveTab] = useState<'overview' | 'chapters' | 'characters' | 'related'>('overview');
  const [chapterSearch, setChapterSearch] = useState('');
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useUserStore();

  const { data: media, isLoading, error } = useQuery({
    queryKey: ['manga', id],
    queryFn: () => getMangaDetail(String(id)),
    enabled: !!id,
  });

  const { data: chapters, isLoading: chaptersLoading } = useQuery({
    queryKey: ['manga-chapters-agg', id],
    queryFn: () => fetchMangaChaptersAction(String(id)),
    enabled: !!id,
  });

  const item = media ? mapAniListToMediaItem(media) : null;
  const allChapters = chapters && chapters.length > 0 ? chapters : [];

  // Filter chapters by search — must be before any conditional returns
  const filteredChapters = useMemo(() => {
    if (!chapterSearch.trim()) return allChapters;
    const q = chapterSearch.toLowerCase();
    return allChapters.filter((ch: MangaChapter) => 
      ch.title.toLowerCase().includes(q) || 
      String(ch.number).includes(q)
    );
  }, [allChapters, chapterSearch]);

  if (isLoading) return <div className="flex items-center justify-center min-h-[60vh]"><LoadingSpinner size={40} /></div>;

  if (error || !media || !item) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-secondary">Failed to load manga details.</p>
      </div>
    );
  }

  const title = item.title;
  const posterUrl = item.posterUrl || '';
  const bannerUrl = item.bannerUrl || item.posterUrl || '';
  const description = item.description?.replace(/<[^>]*>/g, '') || '';
  const inWatchlist = isInWatchlist(item.id);
  const scoreDisplay = item.score ? item.score.toFixed(1) : null;
  const totalChapters = allChapters.length || item.chapterCount || 0;

  const displayChapters = showAllChapters ? filteredChapters : filteredChapters.slice(0, 50);

  const firstChapterHref = allChapters.length > 0 
    ? `/read/${id}/${encodeURIComponent(allChapters[0].id)}?num=${allChapters[0].number}&provider=${allChapters[0].providerName}`
    : `/read/${id}/1?num=1`;

  const handleWatchlist = () => {
    if (inWatchlist) {
      removeFromWatchlist(item.id);
    } else {
      addToWatchlist({
        ...item,
        addedAt: new Date().toISOString(),
        mediaId: item.id,
        mediaType: 'manga',
      } as any);
    }
  };

  // Info rows relevant for manga
  const infoRows = [
    { label: 'Status', value: item.status || '?', isGreen: item.status === 'RELEASING' },
    { label: 'Format', value: item.formatLabel || item.format || '?' },
    { label: 'Chapters', value: item.chapterCount ? String(item.chapterCount) : '?' },
    { label: 'Volumes', value: item.volumeCount ? String(item.volumeCount) : '?' },
    { label: 'Source', value: (item.sourceMedia || '?').replace(/_/g, ' ') },
    { label: 'Country', value: item.countryOfOrigin || '?' },
    ...(item.startDate ? [{ label: 'Start Date', value: formatDate(undefined, item.startDate) }] : []),
    ...(item.nativeTitle ? [{ label: 'Native Title', value: item.nativeTitle }] : []),
    ...(item.synonyms?.length ? [{ label: 'Alt. Titles', value: item.synonyms.join(', ') }] : []),
  ];

  const allCharacters = item.characters || [];
  const allStaff = item.staff || [];

  return (
    <div className="min-h-screen">
      {/* ═══ Banner ═══ */}
      <div className="relative w-full h-[220px] md:h-[280px] overflow-hidden">
        {bannerUrl && <Image src={bannerUrl} alt="" fill className="object-cover" priority sizes="100vw" />}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-void/80 via-transparent to-transparent" />
      </div>

      {/* Back */}
      <button onClick={() => router.back()} className="absolute top-4 left-4 z-10 p-2 rounded-lg bg-surface/80 text-white hover:bg-surface transition-colors">
        <ArrowLeft size={20} />
      </button>

      {/* ═══ Hero Area ═══ */}
      <div className="relative -mt-28 px-4 md:px-6 max-w-7xl mx-auto z-10">
        <div className="flex gap-5 items-end">
          {/* Poster */}
          <div className="relative w-[130px] md:w-[160px] h-[185px] md:h-[230px] rounded-xl overflow-hidden border-2 border-border shadow-xl shrink-0">
            {posterUrl && <Image src={posterUrl} alt={title} fill className="object-cover" sizes="160px" />}
            {scoreDisplay && (
              <div className="absolute top-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                <Star size={9} className="text-accent-gold" fill="currentColor" /> {scoreDisplay}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-2">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <TypeBadge label={item.formatLabel} />
              <TypeBadge label={item.status || 'FINISHED'} variant={item.status === 'RELEASING' ? 'green' : 'default'} />
              {item.year && <TypeBadge label={String(item.year)} />}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white mb-3 line-clamp-2">{title}</h1>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Link href={firstChapterHref} className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                <BookOpen size={16} /> Read Now
              </Link>
              <button onClick={handleWatchlist} className={cn('p-2 rounded-lg border transition-colors cursor-pointer', inWatchlist ? 'bg-accent-green/20 border-accent-green text-accent-green' : 'bg-surface border-border text-text-secondary hover:text-white')}>
                <Bookmark size={18} fill={inWatchlist ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => navigator.clipboard.writeText(window.location.href)} className="p-2 rounded-lg bg-surface border border-border text-text-secondary hover:text-white transition-colors cursor-pointer">
                <Share2 size={18} />
              </button>
              {item.malId && (
                <a href={`https://myanimelist.net/manga/${item.malId}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-[#2e51a2] text-white text-[10px] font-bold flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm" title="View on MyAnimeList">
                  MAL
                </a>
              )}
              {item.anilistId && (
                <a href={`https://anilist.co/manga/${item.anilistId}`} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full bg-[#02a9ff] text-white text-[11px] font-bold flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm" title="View on AniList">
                  A.
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {[
            { label: 'Score', value: scoreDisplay ? `${(item.score * 10).toFixed(0)}%` : 'N/A' },
            { label: 'Chapters', value: totalChapters > 0 ? String(totalChapters) : '?' },
            { label: 'Volumes', value: item.volumeCount ? String(item.volumeCount) : '?' },
            { label: 'Status', value: item.status || '?' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface rounded-lg p-3 text-center border border-border">
              <p className="text-[10px] text-text-secondary mb-0.5 uppercase tracking-wider">{label}</p>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="px-4 md:px-6 max-w-7xl mx-auto mt-6">
        <div className="flex gap-1 border-b border-border mb-6">
          {(['overview', 'chapters', 'characters', 'related'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium capitalize transition-colors cursor-pointer",
                activeTab === tab
                  ? "text-white border-b-2 border-white"
                  : "text-text-secondary hover:text-white"
              )}
            >
              {tab === 'chapters' ? `Chapters${totalChapters > 0 ? ` (${totalChapters})` : ''}` : tab}
            </button>
          ))}
        </div>

        {/* ═══ Tab Content ═══ */}
        <div className="pb-12">
          {/* ─── Overview ─── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Synopsis */}
              {description && (
                <div className="bg-surface/30 p-4 rounded-xl border border-border">
                  <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Synopsis</h3>
                  <p className={cn(
                    "text-xs md:text-sm text-text-secondary leading-relaxed transition-all",
                    !isDescExpanded && "line-clamp-3"
                  )}>
                    {description}
                  </p>
                  <button
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="text-xs font-bold text-accent-green hover:underline mt-2 block select-none cursor-pointer"
                  >
                    {isDescExpanded ? 'Show less' : 'Show more'}
                  </button>
                </div>
              )}

              {/* Ratings */}
              <div className="bg-surface/30 p-4 rounded-xl border border-border">
                <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Ratings & Reviews</h3>
                <div className="flex items-center gap-3 mb-3">
                  {item.meanScore ? (
                    <div className="bg-surface rounded-xl p-3 border border-border text-center flex-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">AniList</span>
                      <span className="text-base font-extrabold text-white">{item.meanScore}%</span>
                    </div>
                  ) : null}
                  {scoreDisplay ? (
                    <div className="bg-surface rounded-xl p-3 border border-border text-center flex-1">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-0.5">Average</span>
                      <span className="text-base font-extrabold text-white">{(item.score * 10).toFixed(0)}%</span>
                    </div>
                  ) : null}
                </div>
                <a 
                  href={`https://myanimelist.net/manga/${item.malId || ''}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full text-center text-xs font-bold text-[#2e51a2] hover:bg-[#2e51a2]/10 transition-colors py-2.5 bg-[#2e51a2]/5 border border-[#2e51a2]/20 rounded-xl cursor-pointer block"
                >
                  View on MyAnimeList
                </a>
              </div>

              {/* Info Table */}
              <div className="rounded-lg overflow-hidden border border-border">
                {infoRows.map(({ label, value, isGreen }, i) => (
                  <div key={label} className={`flex px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-surface' : 'bg-void'}`}>
                    <span className="text-text-secondary w-32 shrink-0">{label}</span>
                    <span className={isGreen ? 'text-accent-green' : 'text-white'}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Genres */}
              {item.genres?.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-white mb-3">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.genres.map((g) => (
                      <span key={g} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{g}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-white mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.slice(0, 15).map((t) => (
                      <span key={t} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Staff (Author/Artist only for manga) */}
              {allStaff.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-white mb-3">Author & Artist</h3>
                  <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                    {allStaff.slice(0, 6).map((s, idx) => (
                      <div key={`${s.id}-${idx}`} className="shrink-0 w-[100px] text-center">
                        <div className="relative w-20 h-24 rounded-lg overflow-hidden bg-surface mx-auto mb-2">
                          <Image src={s.image} alt={s.name} fill className="object-cover" sizes="80px" />
                        </div>
                        <p className="text-[10px] text-accent-green font-bold uppercase tracking-tighter mb-0.5 line-clamp-1">{s.role}</p>
                        <p className="text-xs text-white font-medium line-clamp-1">{s.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Chapters ─── */}
          {activeTab === 'chapters' && (
            <div className="space-y-4">
              {/* Search & Provider info */}
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder="Search chapters..."
                    className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-white placeholder:text-text-secondary focus:outline-none focus:border-accent-green/50"
                  />
                </div>
                {allChapters.length > 0 && (
                  <span className="text-[10px] text-zinc-500 font-mono bg-surface px-2 py-1 rounded border border-border uppercase">
                    via {allChapters[0].providerName}
                  </span>
                )}
              </div>

              {chaptersLoading ? (
                <div className="py-12 flex justify-center"><LoadingSpinner size={30} /></div>
              ) : allChapters.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen size={40} className="mx-auto text-text-secondary mb-3 opacity-50" />
                  <p className="text-text-secondary text-sm">No chapters found from reading providers.</p>
                  <p className="text-text-secondary text-xs mt-1">Try checking MangaDex directly for availability.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {displayChapters.map((ch: MangaChapter) => (
                      <Link
                        key={ch.id}
                        href={`/read/${id}/${encodeURIComponent(ch.id)}?num=${ch.number}&provider=${ch.providerName}`}
                        className="group p-3 bg-surface border border-border rounded-lg hover:border-accent-green/50 transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-white group-hover:text-accent-green transition-colors block truncate">
                            Ch. {ch.number}
                          </span>
                          {ch.title !== `Chapter ${ch.number}` && (
                            <span className="text-[11px] text-text-secondary block truncate">{ch.title}</span>
                          )}
                        </div>
                        {ch.releasedDate && (
                          <span className="text-[10px] text-text-secondary shrink-0">
                            {new Date(ch.releasedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>

                  {filteredChapters.length > 50 && (
                    <button
                      onClick={() => setShowAllChapters(!showAllChapters)}
                      className="w-full py-3 text-center text-sm font-medium text-accent-green bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {showAllChapters ? <><ChevronUp size={14} /> Show Less</> : <><ChevronDown size={14} /> Show All {filteredChapters.length} Chapters</>}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── Characters ─── */}
          {activeTab === 'characters' && (
            <div className="space-y-2">
              {allCharacters.length === 0 ? (
                <p className="text-text-secondary text-sm py-8 text-center">No character data available.</p>
              ) : (
                allCharacters.map((char, idx) => (
                  <div key={`${char.id}-${idx}`} className="flex items-center gap-3 bg-surface rounded-lg p-3 border border-border">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-void shrink-0">
                      <Image src={char.image} alt={char.name} fill className="object-cover" sizes="48px" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{char.name}</p>
                      <p className="text-xs text-text-secondary">{char.role}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── Related ─── */}
          {activeTab === 'related' && (
            <div className="space-y-6">
              {/* Relations */}
              {item.relations && item.relations.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-white mb-3">Relations</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {item.relations.map((r) => {
                      const href = r.type === 'manga' ? `/manga/${r.id}` : r.type === 'movie' ? `/movies/${r.id}` : r.type === 'tv' ? `/tv/${r.id}` : `/anime/${r.id}`;
                      return (
                        <Link key={r.id} href={href} className="group">
                          <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface border border-border group-hover:border-accent-green/50 transition-all mb-1.5">
                            {r.posterUrl && <Image src={r.posterUrl} alt={r.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="150px" />}
                          </div>
                          <p className="text-[10px] text-accent-green font-bold uppercase mb-0.5">{r.relationType?.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-white font-medium line-clamp-2">{r.title}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {item.recommendations && item.recommendations.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold text-white mb-3">Recommended</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {item.recommendations.map((r) => {
                      const href = r.type === 'manga' ? `/manga/${r.id}` : r.type === 'movie' ? `/movies/${r.id}` : r.type === 'tv' ? `/tv/${r.id}` : `/anime/${r.id}`;
                      return (
                        <Link key={r.id} href={href} className="group">
                          <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface border border-border group-hover:border-accent-green/50 transition-all mb-1.5">
                            {r.posterUrl && <Image src={r.posterUrl} alt={r.title} fill className="object-cover group-hover:scale-105 transition-transform" sizes="150px" />}
                          </div>
                          <p className="text-xs text-white font-medium line-clamp-2">{r.title}</p>
                          {r.year && <p className="text-[11px] text-text-secondary">{r.year}</p>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {(!item.relations || item.relations.length === 0) && (!item.recommendations || item.recommendations.length === 0) && (
                <p className="text-text-secondary text-sm py-8 text-center">No related media found.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
