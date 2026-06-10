'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { 
  Info, X, ThumbsUp, ThumbsDown, Mic, Server as ServerIcon, 
  Share2, Download, Flag, MessageSquare, ChevronDown, ArrowUp, Check 
} from 'lucide-react';
import { getAnimeDetail, getAnimeByMalId } from '@/lib/api/anilist';
import { getMovieDetails, getTVDetails } from '@/lib/api/tmdb';
import { getMediaEpisodes, extractId, getHybridRecommendations } from '@/lib/api/hybrid';
import { usePlayerStore } from '@/store/playerStore';
import { useUserStore } from '@/store/userStore';
import VideoPlayer from '@/components/player/VideoPlayer';
import EpisodeSidebar from '@/components/player/EpisodeSidebar';
import RecentlyUpdated from '@/components/home/RecentlyUpdated';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils/cn';
import type { Server } from '@/types/server';
import type { MediaItem } from '@/types/media';

function WatchContent() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id') || '';
  const mediaId = extractId(rawId);
  const mediaType = searchParams.get('type') || 'anime';
  const epNum = Number(searchParams.get('ep') || '1');
  const seasonNum = Number(searchParams.get('season') || '1');

  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const { setShowDownloadModal, activeServerId, setActiveServer } = usePlayerStore();
  const { addToHistory } = useUserStore();

  const [showAlertStrip, setShowAlertStrip] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serversList, setServersList] = useState<Server[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);
  const [activeAd, setActiveAd] = useState<any>(null);
  const [viewCount, setViewCount] = useState<number | null>(null);

  const toggleWatchlist = () => setInWatchlist(!inWatchlist);
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowShareTooltip(true);
    setTimeout(() => setShowShareTooltip(false), 2000);
  };
  const handleReport = () => {
    alert("Report functionality to be implemented");
  };

  // Unified fetch for any media type
  const { data: media, isLoading } = useQuery({
    queryKey: ['media', mediaType, rawId],
    queryFn: async () => {
      if (mediaType === 'anime') {
        if (rawId.startsWith('mal-')) {
          return getAnimeByMalId(String(mediaId));
        }
        return getAnimeDetail(String(mediaId));
      }
      if (mediaType === 'movie') return getMovieDetails(Number(mediaId));
      if (mediaType === 'tv') return getTVDetails(Number(mediaId));
      return null;
    },
    enabled: !!mediaId,
  });

  // Fetch recommendations
  useEffect(() => {
    if (!rawId) return;
    getHybridRecommendations(rawId, mediaType).then(setRecommendations);
  }, [rawId, mediaType]);

  // Fetch reviews
  useEffect(() => {
    if (!rawId || !media) return;
    setReviewsLoading(true);
    let url = '';
    const malIdForJikan = rawId.startsWith('mal-') ? mediaId : ((media as any)?.idMal || mediaId);
    
    if (mediaType === 'anime') {
      url = `/api/jikan/anime/${malIdForJikan}/reviews`;
    } else {
      url = `/api/tmdb/${mediaType}/${mediaId}/reviews`;
    }
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (mediaType === 'anime') {
          setReviews(data.data || []);
        } else {
          setReviews(data.results || []);
        }
        setReviewsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch reviews', err);
        setReviews([]);
        setReviewsLoading(false);
      });
  }, [rawId, mediaType, mediaId, media]);

  // Fetch server configs for the popup modal
  useEffect(() => {
    fetch('/servers.json').then(r => r.json()).then(setServersList).catch(() => {});
  }, []);

  // Fetch targeted media ads
  useEffect(() => {
    const fetchAd = async () => {
      const supabase = createClient();
      
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'global_ads_enabled')
        .single();
        
      if (settingsData && (settingsData.value === 'false' || settingsData.value === false)) return;

      const { data: adData } = await supabase
        .from('media_ads')
        .select('*')
        .eq('is_active', true)
        .or(`media_id.eq.${rawId},media_id.eq.${mediaId}`)
        .limit(1)
        .single();

      if (adData) setActiveAd(adData);
    };
    if (rawId && mediaId) fetchAd();
  }, [rawId, mediaId, mediaType]);

  // Normalization logic for different API responses
  const title = mediaType === 'anime' 
    ? (media as any)?.title?.english || (media as any)?.title?.romaji 
    : (media as any)?.title || (media as any)?.name;
  
  const seriesTitle = mediaType === 'anime' 
    ? (media as any)?.title?.romaji 
    : (media as any)?.title || (media as any)?.name;

  const malId = rawId.startsWith('mal-') ? mediaId : ((media as any)?.idMal || 0);
  const bannerImage = mediaType === 'anime'
    ? (media as any)?.bannerImage || (media as any)?.coverImage?.extraLarge
    : `https://image.tmdb.org/t/p/original${(media as any)?.backdrop_path}`;
  
  const posterImage = mediaType === 'anime'
    ? (media as any)?.coverImage?.large
    : `https://image.tmdb.org/t/p/w300${(media as any)?.poster_path}`;

  // Automatically record view state to portable user history store
  useEffect(() => {
    if (!media) return;
    addToHistory({
      mediaId: rawId.includes('-') ? rawId : (mediaType === 'anime' ? `anilist-${rawId}` : (mediaType === 'movie' ? `tmdb-movie-${rawId}` : `tmdb-tv-${rawId}`)),
      mediaType: mediaType as 'anime' | 'movie' | 'tv',
      episodeNumber: epNum,
      episodeTitle: title || 'Streaming',
      mediaTitle: seriesTitle || 'Unknown',
      watchedAt: new Date().toISOString(),
      progress: 0.15,
      thumbnailUrl: bannerImage,
      posterUrl: posterImage,
      duration: (media as any)?.duration || 24,
    });
  }, [media, mediaType, epNum, title, seriesTitle, bannerImage, posterImage, addToHistory, rawId]);

  // Reset viewCount and activeAd when rawId changes
  useEffect(() => {
    setViewCount(null);
    setActiveAd(null);
  }, [rawId]);

  // Initialize viewCount once when media is loaded
  useEffect(() => {
    if (media && viewCount === null) {
      const count = ((media as any)?.views || (media as any)?.popularity * 1342 || Math.floor(Math.random() * 500000));
      setViewCount(Math.floor(count));
    }
  }, [media, viewCount]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  // Filter available servers array for the overlay switcher
  const patternKey = mediaType === 'anime' ? 'anime_sub' : mediaType === 'movie' ? 'movie' : 'tv';
  const availableServers = [
    {
      id: 'omniflow_direct',
      name: 'OmniFlow Player (Premium HLS)',
      baseUrl: '',
      patterns: {
        movie: 'direct',
        tv: 'direct',
        anime_sub: 'direct',
        anime_dub: 'direct'
      },
      status: 'active',
      recommended: true
    },
    ...serversList.filter(s => s.status === 'active' && s.patterns[patternKey as keyof typeof s.patterns])
  ];

  return (
    <div className="max-w-[1550px] mx-auto px-4 md:px-6 py-4 pt-20">
      {/* Top Breadcrumb Nav Strip */}
      <div className="flex items-center gap-2 text-xs font-bold text-text-muted mb-4 tracking-wide truncate">
        <Link href="/" className="hover:text-white transition-colors">≡ Home</Link>
        <span>&gt;</span>
        <Link href={`/${mediaType}/${mediaId}`} className="hover:text-white transition-colors">{seriesTitle}</Link>
        <span>&gt;</span>
        <span className="text-white truncate">{title}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Top/Left Section: Player & Detail Ecosystem */}
        <div className="w-full space-y-4">
          {/* Main Integrated Video Player */}
          <div className="rounded-xl overflow-hidden border border-border shadow-2xl bg-void">
              <VideoPlayer
                malId={malId}
                tmdbId={mediaId}
                mediaType={mediaType}
                episode={epNum}
                season={seasonNum}
                mediaTitle={seriesTitle}
              imdbId={(media as any)?.imdb_id || (media as any)?.external_ids?.imdb_id || undefined}
            />
          </div>

          {/* Warning Alert Strip matching pixel-perfect color tokens */}
          {showAlertStrip && (
            <div className="flex items-center justify-between bg-[#2A1B0A]/80 border border-[#A8641A]/50 rounded-lg px-4 py-2.5 text-[#E69D37] text-xs font-medium">
              <div className="flex items-center gap-2">
                <Info size={14} className="shrink-0" />
                <span>If the current server doesn&apos;t work, feel free to try the other available servers.</span>
              </div>
              <button
                onClick={() => setShowAlertStrip(false)}
                className="text-[#E69D37]/70 hover:text-[#E69D37] transition-colors p-1 cursor-pointer shrink-0 ml-2"
                title="Dismiss warning"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Episode Title String */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white font-display">
              {title}
            </h1>
          </div>

          {/* Avatar Row */}
          <div className="flex items-center justify-between pb-2">
            <Link href={`/${mediaType}/${rawId}`} className="flex items-center gap-3 group">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0 border border-white/10 group-hover:border-accent-green transition-colors">
                <Image
                  src={posterImage}
                  alt={seriesTitle}
                  fill
                  className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-wide group-hover:text-accent-green transition-colors">{seriesTitle}</p>
                <p className="text-xs text-text-muted">{((media as any)?.popularity || (media as any)?.averageScore || 7200).toLocaleString()} users</p>
              </div>
            </Link>

            <div className="relative">
              <button 
                onClick={toggleWatchlist}
                className={cn(
                  "flex items-center gap-2 font-bold text-xs px-4 py-2 rounded-full transition-colors cursor-pointer shadow-md",
                  inWatchlist ? "bg-accent-green/20 text-accent-green border border-accent-green/50" : "bg-white hover:bg-gray-200 text-black"
                )}
              >
                {inWatchlist ? <><Check size={14} /> In List</> : 'Add to List'}
              </button>
            </div>
          </div>

          {/* Action Buttons Row matching Video Player Page.png exactly */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center bg-surface/60 rounded-full border border-border/40 overflow-hidden">
              <button className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white hover:bg-surface transition-colors cursor-pointer border-r border-border/40">
                <ThumbsUp size={13} />
                <span>{((media as any)?.favourites || (media as any)?.vote_count || 0).toLocaleString()}</span>
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-text-secondary hover:text-white hover:bg-surface transition-colors cursor-pointer">
                <ThumbsDown size={13} />
              </button>
            </div>

            {/* Server Trigger opens floating overlay switcher modal */}
            <button
              onClick={() => setShowServerModal(true)}
              className="flex items-center gap-1.5 bg-accent-green/10 hover:bg-accent-green/20 border border-accent-green/30 px-4 py-2 rounded-full text-xs font-bold text-accent-green transition-all cursor-pointer shadow-sm"
            >
              <ServerIcon size={13} />
              <span>Server</span>
            </button>

            {/* Share action */}
            <div className="relative">
              <button onClick={handleShare} className="flex items-center gap-1.5 bg-surface/60 hover:bg-surface px-3.5 py-2 rounded-full border border-border/40 text-xs font-bold text-white transition-colors cursor-pointer">
                <Share2 size={13} />
                <span>Share</span>
              </button>
              {showShareTooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black border border-border rounded text-[10px] text-white whitespace-nowrap z-10 animate-fade-in">
                  Link copied!
                </div>
              )}
            </div>

            {/* We will determine download availability based on the loaded sources */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDownloadModal(true);
              }}
              className="flex items-center justify-center bg-accent-green/20 hover:bg-accent-green/40 w-8 h-8 rounded-full border border-accent-green/30 text-accent-green transition-colors cursor-pointer shadow-[0_0_10px_rgba(0,230,118,0.2)]"
              title="Download Stream"
            >
              <Download size={13} />
            </button>

            <button onClick={handleReport} className="flex items-center gap-1.5 bg-surface/60 hover:bg-surface px-3.5 py-2 rounded-full border border-border/40 text-xs font-bold text-text-secondary hover:text-white transition-colors cursor-pointer ml-auto">
              <Flag size={13} />
              <span>Report</span>
            </button>
          </div>

          {/* Targeted Media Ad Banner */}
          {activeAd && (
            <div className="w-full relative group rounded-xl overflow-hidden border border-border/50 shadow-lg bg-surface mt-4 mb-2 animate-fade-in block">
              <a href={activeAd.target_url} target="_blank" rel="noopener noreferrer" className="block relative w-full h-[100px] sm:h-[120px] md:h-[150px]">
                <Image 
                  src={activeAd.image_url} 
                  alt={activeAd.title || 'Advertisement'} 
                  fill 
                  className="object-cover group-hover:scale-105 transition-transform duration-500" 
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 100vw"
                />
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-white/20">
                  Advertisement
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="bg-accent-green text-black font-bold text-xs px-4 py-2 rounded-full shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                    Visit Sponsor
                  </span>
                </div>
              </a>
            </div>
          )}

          {/* Expandable Description Box Block */}
          <div
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="bg-surface/30 hover:bg-surface/40 border border-border/30 rounded-xl p-4 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 text-xs font-bold text-white mb-2">
              <span>{(viewCount || 0).toLocaleString()} views</span>
              <span>
                {mediaType === 'anime' 
                  ? ((media as any)?.startDate?.year ? `${(media as any).startDate.year}-${String((media as any).startDate.month).padStart(2,'0')}-${String((media as any).startDate.day).padStart(2,'0')}` : 'Unknown')
                  : ((media as any)?.release_date || (media as any)?.first_air_date || 'Unknown')
                }
              </span>
            </div>
            <p className={cn(
              "text-xs text-text-secondary leading-relaxed transition-all",
              !isDescriptionExpanded && "line-clamp-2"
            )}>
              {((media as any)?.description || (media as any)?.overview || '').replace(/<[^>]*>/g, '') || 
                "Alvida pirates plunder a ship only to find a barrel containing a strange boy named Luffy who is on a quest to find the legendary One Piece and become the King of Pirates."}
            </p>
            <span className="block text-[10px] font-bold text-text-muted group-hover:text-white transition-colors mt-2 text-right uppercase tracking-wider">
              {isDescriptionExpanded ? 'Show less' : 'Click to expand description'}
            </span>
          </div>
        </div>

        {/* Right Column / Mobile Middle: Integrated Up Next Sidebar */}
        <div className="w-full xl:row-span-2">
          <EpisodeSidebar
            mediaId={rawId}
            mediaType={mediaType}
            currentEp={epNum}
            totalEpisodes={mediaType === 'anime' ? ((media as any)?.episodes || ((media as any)?.nextAiringEpisode?.episode ? (media as any).nextAiringEpisode.episode - 1 : 12)) : (media as any)?.number_of_episodes || 1}
            title={title}
            nextAiringEpisode={(media as any)?.nextAiringEpisode}
            recommendations={recommendations}
          />
        </div>

        {/* Bottom Section: Reviews & Recently Updated */}
        <div className="w-full space-y-4 xl:col-start-1 xl:row-start-2">
          {/* Reviews Discussion Ecosystem */}
          {(!reviewsLoading && reviews.length > 0) ? (
            <div className="bg-void rounded-xl border border-border/80 p-4 space-y-4">
              {/* Top Comments Header Row */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{reviews.length} Reviews</h3>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1 bg-surface border border-border px-2.5 py-1 rounded text-xs font-bold text-text-secondary hover:text-white transition-colors">
                    <span>Sort by</span>
                    <ChevronDown size={13} />
                  </button>
                </div>
              </div>

              {/* Input Composer Field - Disabled */}
              <div className="flex gap-3 items-start bg-surface/30 p-3 rounded-lg border border-border/40 opacity-70">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface shrink-0 border border-white/5 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">U</span>
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    disabled
                    placeholder="Adding reviews is currently disabled. Displaying external reviews."
                    className="w-full bg-transparent text-xs text-white placeholder:text-text-muted outline-none pb-2 border-b border-border/40 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Rendered Review Stream */}
              <div className="space-y-4 pt-2">
                {reviews.slice(0, 10).map((review: any, idx: number) => {
                  const authorName = review.author || review.user?.username || 'Anonymous';
                  const authorImage = review.author_details?.avatar_path 
                    ? (review.author_details.avatar_path.startsWith('/') 
                      ? `https://image.tmdb.org/t/p/w200${review.author_details.avatar_path}` 
                      : review.author_details.avatar_path)
                    : (review.user?.images?.jpg?.image_url || `https://ui-avatars.com/api/?name=${authorName}&background=random`);
                  const date = review.created_at || review.date || '';
                  const content = review.content || review.review || '';
                  
                  return (
                    <div key={review.id || idx} className={`flex gap-3 items-start ${idx > 0 ? 'pt-4 border-t border-border/30' : ''}`}>
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface shrink-0 border border-white/5 mt-0.5">
                        <Image src={authorImage} alt={authorName} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-white">{authorName}</span>
                          {date && <span className="text-[10px] text-text-muted">{new Date(date).toLocaleDateString()}</span>}
                        </div>
                        <p className="text-xs text-text-secondary mb-2 line-clamp-4">
                          {content.replace(/<[^>]*>?/gm, '')}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-text-muted">
                          <button className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            <ThumbsUp size={12} />
                            <span>{review.reactions?.nice || 0}</span>
                          </button>
                          <button className="hover:text-white transition-colors font-medium cursor-pointer">
                            ••• More
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            reviewsLoading && (
              <div className="bg-void rounded-xl border border-border/80 p-8 flex justify-center items-center">
                <LoadingSpinner size={24} />
              </div>
            )
          )}

          <div className="pt-4">
            <RecentlyUpdated />
          </div>
        </div>
      </div>

      {/* Floating Glassmorphic Server Switcher Overlay Popup Modal */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-void border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-white font-display">Switch Streaming Server</h3>
                <p className="text-xs text-text-secondary mt-0.5">Select a verified high-speed CDN adapter node</p>
              </div>
              <button
                onClick={() => setShowServerModal(false)}
                className="w-8 h-8 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center text-text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {availableServers.map((server) => {
                const isActive = activeServerId === server.id;

                return (
                  <button
                    key={server.id}
                    onClick={() => {
                      setActiveServer(server.id);
                      setShowServerModal(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer group",
                      isActive
                        ? "bg-accent-green/10 border-accent-green"
                        : "bg-surface/40 border-border hover:bg-surface hover:border-accent-green/30"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isActive ? "bg-accent-green shadow-[0_0_8px_#00E676]" : "bg-text-muted"
                        )} />
                        <span className={cn(
                          "text-xs font-bold transition-colors",
                          isActive ? "text-accent-green" : "text-white group-hover:text-accent-green"
                        )}>
                          {server.name}
                        </span>
                        {server.recommended && (
                          <span className="text-[9px] font-bold bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded uppercase">
                            Fastest
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        CDN Protocol stream cluster
                      </p>
                    </div>

                    <span className="text-xs text-text-muted font-medium group-hover:text-white transition-colors">
                      {isActive ? 'Active Node' : 'Connect →'}
                    </span>
                  </button>
                );
              })}

              {availableServers.length === 0 && (
                <p className="text-xs text-center text-text-muted py-6">No dedicated servers active for this source pattern</p>
              )}
            </div>

            <div className="pt-2 border-t border-border/40">
              <p className="text-[10px] text-center text-text-muted">
                If playback buffers continuously, clearing your cache or rotating host nodes typically restores optimal bitrates instantly.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[70vh]"><LoadingSpinner size={40} /></div>}>
      <WatchContent />
    </Suspense>
  );
}
