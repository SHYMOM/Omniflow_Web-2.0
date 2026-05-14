'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Info, X, ThumbsUp, ThumbsDown, Mic, Server as ServerIcon, 
  Share2, Download, Flag, MessageSquare, ChevronDown, ArrowUp 
} from 'lucide-react';
import { getAnimeDetail } from '@/lib/api/anilist';
import { extractId } from '@/lib/api/hybrid';
import { usePlayerStore } from '@/store/playerStore';
import { useUserStore } from '@/store/userStore';
import VideoPlayer from '@/components/player/VideoPlayer';
import EpisodeSidebar from '@/components/player/EpisodeSidebar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils/cn';
import type { Server } from '@/types/server';

function WatchContent() {
  const searchParams = useSearchParams();
  const rawId = searchParams.get('id') || '';
  const mediaId = extractId(rawId);
  const mediaType = searchParams.get('type') || 'anime';
  const epNum = Number(searchParams.get('ep') || '1');

  const { activeServerId, setActiveServer } = usePlayerStore();
  const { addToHistory } = useUserStore();

  const [showAlertStrip, setShowAlertStrip] = useState(true);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serversList, setServersList] = useState<Server[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);

  // Fetch actual media detail or use resilient fallback strings
  const { data: media, isLoading } = useQuery({
    queryKey: ['anime', mediaId],
    queryFn: () => getAnimeDetail(mediaId),
    enabled: !!mediaId && mediaType === 'anime',
  });

  // Fetch server configs for the popup modal
  useEffect(() => {
    fetch('/servers.json').then(r => r.json()).then(setServersList).catch(() => {});
  }, []);

  const title = media?.title.english || media?.title.romaji || "I'm Luffy! The Man Who's Gonna Be King of the Pirates!";
  const seriesTitle = media?.title.romaji || 'ONE PIECE';
  const malId = media?.idMal || 21;
  const bannerImage = media?.bannerImage || 'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg';

  // Automatically record view state to portable user history store
  useEffect(() => {
    addToHistory({
      mediaId: rawId.includes('-') ? rawId : (mediaType === 'anime' ? `anilist-${rawId}` : `tmdb-${rawId}`),
      mediaType: mediaType as 'anime' | 'movie' | 'tv',
      episodeNumber: epNum,
      episodeTitle: title,
      mediaTitle: seriesTitle,
      watchedAt: new Date().toISOString(),
      progress: 0.15,
      thumbnailUrl: bannerImage,
      posterUrl: bannerImage,
      duration: 1440,
    });
  }, [mediaId, mediaType, epNum, title, seriesTitle, bannerImage, addToHistory]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <LoadingSpinner size={40} />
      </div>
    );
  }

  // Filter available servers array for the overlay switcher
  const patternKey = mediaType === 'anime' ? 'anime_sub' : mediaType === 'movie' ? 'movie' : 'tv';
  const availableServers = serversList.filter(s => s.status === 'active' && s.patterns[patternKey as keyof typeof s.patterns]);

  return (
    <div className="max-w-[1550px] mx-auto px-4 md:px-6 py-4 pt-20">
      {/* Top Breadcrumb Nav Strip */}
      <div className="flex items-center gap-2 text-xs font-bold text-text-muted mb-4 tracking-wide truncate">
        <Link href="/" className="hover:text-white transition-colors">≡ Home</Link>
        <span>&gt;</span>
        <Link href={`/anime/${mediaId}`} className="hover:text-white transition-colors">{seriesTitle}</Link>
        <span>&gt;</span>
        <span className="text-white truncate">{title}</span>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Left Column: Player & Detail Ecosystem */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* Main Integrated Video Player */}
          <div className="rounded-xl overflow-hidden border border-border shadow-2xl bg-void">
            <VideoPlayer
              malId={malId}
              tmdbId={mediaId}
              mediaType={mediaType}
              episode={epNum}
              season={1}
              serverId={activeServerId}
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
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0 border border-white/10">
                <Image
                  src="https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx21-YCDoj1EkAxFn.jpg"
                  alt={seriesTitle}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-wide">{seriesTitle}</p>
                <p className="text-xs text-text-muted">7.2K users</p>
              </div>
            </div>

            <button className="bg-white hover:bg-gray-200 text-black font-bold text-xs px-4 py-2 rounded-full transition-colors cursor-pointer shadow-md">
              Add to List
            </button>
          </div>

          {/* Action Buttons Row matching Video Player Page.png exactly */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="flex items-center bg-surface/60 rounded-full border border-border/40 overflow-hidden">
              <button className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white hover:bg-surface transition-colors cursor-pointer border-r border-border/40">
                <ThumbsUp size={13} />
                <span>622</span>
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-text-secondary hover:text-white hover:bg-surface transition-colors cursor-pointer">
                <ThumbsDown size={13} />
                <span>4</span>
              </button>
            </div>

            <button className="flex items-center gap-1.5 bg-surface/60 hover:bg-surface px-3.5 py-2 rounded-full border border-border/40 text-xs font-bold text-white transition-colors cursor-pointer">
              <Mic size={13} />
              <span>Dub</span>
            </button>

            {/* Server Trigger opens floating overlay switcher modal */}
            <button
              onClick={() => setShowServerModal(true)}
              className="flex items-center gap-1.5 bg-accent-green/10 hover:bg-accent-green/20 border border-accent-green/30 px-4 py-2 rounded-full text-xs font-bold text-accent-green transition-all cursor-pointer shadow-sm"
            >
              <ServerIcon size={13} />
              <span>Server</span>
            </button>

            <button className="flex items-center gap-1.5 bg-surface/60 hover:bg-surface px-3.5 py-2 rounded-full border border-border/40 text-xs font-bold text-white transition-colors cursor-pointer">
              <Share2 size={13} />
              <span>Share</span>
            </button>

            <button className="flex items-center justify-center bg-surface/60 hover:bg-surface w-8 h-8 rounded-full border border-border/40 text-white transition-colors cursor-pointer">
              <Download size={13} />
            </button>

            <button className="flex items-center gap-1.5 bg-surface/60 hover:bg-surface px-3.5 py-2 rounded-full border border-border/40 text-xs font-bold text-text-secondary hover:text-white transition-colors cursor-pointer ml-auto">
              <Flag size={13} />
              <span>Report</span>
            </button>
          </div>

          {/* Expandable Description Box Block */}
          <div
            onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
            className="bg-surface/30 hover:bg-surface/40 border border-border/30 rounded-xl p-4 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-3 text-xs font-bold text-white mb-2">
              <span>470K views</span>
              <span>Oct 20, 1999</span>
            </div>
            <p className={cn(
              "text-xs text-text-secondary leading-relaxed transition-all",
              !isDescriptionExpanded && "line-clamp-2"
            )}>
              {media?.description?.replace(/<[^>]*>/g, '') || 
                "Alvida pirates plunder a ship only to find a barrel containing a strange boy named Luffy who is on a quest to find the legendary One Piece and become the King of Pirates."}
            </p>
            <span className="block text-[10px] font-bold text-text-muted group-hover:text-white transition-colors mt-2 text-right uppercase tracking-wider">
              {isDescriptionExpanded ? 'Show less' : 'Click to expand description'}
            </span>
          </div>

          {/* 68 Comments Discussion Ecosystem */}
          <div className="bg-void rounded-xl border border-border/80 p-4 space-y-4">
            {/* Top Comments Header Row */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">68 Comments</h3>
              <div className="flex items-center gap-2">
                <button className="bg-surface border border-border px-3 py-1 rounded text-xs font-bold text-white">
                  EP 1
                </button>
                <button className="flex items-center gap-1 bg-surface border border-border px-2.5 py-1 rounded text-xs font-bold text-text-secondary hover:text-white transition-colors">
                  <span>Sort by</span>
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>

            {/* Input Composer Field */}
            <div className="flex gap-3 items-start bg-surface/30 p-3 rounded-lg border border-border/40">
              <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface shrink-0 border border-white/5">
                <Image src="https://s4.anilist.co/file/anilistcdn/character/large/b66-HHPz6tH3A4QZ.png" alt="User" fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  placeholder="Did this episode meet your expectations?"
                  className="w-full bg-transparent text-xs text-white placeholder:text-text-muted outline-none pb-2 border-b border-border/40 focus:border-accent-green transition-colors"
                />
                <div className="flex items-center justify-end gap-3 mt-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isSpoiler}
                      onChange={e => setIsSpoiler(e.target.checked)}
                      className="accent-accent-green rounded"
                    />
                    <span>Spoiler</span>
                  </label>
                  <button
                    onClick={() => {
                      if (!commentInput.trim()) return;
                      setCommentInput('');
                      alert('Comment submitted successfully!');
                    }}
                    className="w-6 h-6 rounded-full bg-white hover:bg-gray-200 text-black flex items-center justify-center transition-colors cursor-pointer font-bold"
                  >
                    <ArrowUp size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Rendered Comment Stream matching screenshot */}
            <div className="space-y-4 pt-2">
              <div className="flex gap-3 items-start">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface shrink-0 border border-white/5 mt-0.5">
                  <Image src="https://s4.anilist.co/file/anilistcdn/character/large/b88366-XWdvdqM5E2QW.png" alt="jozvert" fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white">jozvert</span>
                    <span className="text-[10px] text-text-muted">1y ago</span>
                  </div>
                  <p className="text-xs text-white font-bold tracking-wide mb-2">
                    IS ANYONE SINGLE BI IM LOOKING FOR FINE SHIT
                  </p>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <button className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                      <ThumbsUp size={12} />
                      <span>3</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                      <ThumbsDown size={12} />
                      <span>9</span>
                    </button>
                    <button className="hover:text-white transition-colors font-medium cursor-pointer">
                      Reply
                    </button>
                    <button className="hover:text-white transition-colors font-medium cursor-pointer">
                      ••• More
                    </button>
                  </div>
                  <button className="text-[11px] font-bold text-accent-green mt-2 hover:underline block">
                    24 replies ▽
                  </button>
                </div>
              </div>

              <div className="flex gap-3 items-start pt-2 border-t border-border/30">
                <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface shrink-0 border border-white/5 mt-0.5">
                  <Image src="https://s4.anilist.co/file/anilistcdn/character/large/b40-q0LeROWxPGK0.png" alt="subtoshadow991" fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white">subtoshadow991</span>
                    <span className="text-[10px] text-text-muted">1y ago</span>
                  </div>
                  <p className="text-xs text-text-secondary mb-2">
                    Classic golden age animation. Rewatching for the 5th time in anticipation for the ultimate finale arc!
                  </p>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <button className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                      <ThumbsUp size={12} />
                      <span>45</span>
                    </button>
                    <button className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                      <ThumbsDown size={12} />
                      <span>1</span>
                    </button>
                    <button className="hover:text-white transition-colors font-medium cursor-pointer">
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Integrated Up Next Sidebar */}
        <div className="w-full xl:w-[380px] shrink-0">
          <EpisodeSidebar
            mediaId={mediaId}
            mediaType={mediaType}
            currentEp={epNum}
            malId={malId}
            totalEpisodes={media?.episodes || 0}
            title={title}
          />
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
                          isActive ? "bg-accent-green shadow-[0_0_8px_#A8FF35]" : "bg-text-muted"
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
                        {server.type.toUpperCase()} Protocol stream cluster
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
