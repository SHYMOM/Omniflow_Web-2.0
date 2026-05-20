'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  Settings, Download, RotateCcw, AlertCircle, Info, Subtitles 
} from 'lucide-react';
import { buildEmbedUrl } from '@/lib/utils/serverBuilder';
import type { Server } from '@/types/server';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePlayerStore } from '@/store/playerStore';

interface VideoPlayerProps {
  malId: number;
  tmdbId: number;
  mediaType: string;
  episode: number;
  season: number;
  serverId: string;
}

interface StreamSubtitle {
  label: string;
  url: string;
  lang: string;
  default?: boolean;
}

export default function VideoPlayer({ malId, tmdbId, mediaType, episode, season, serverId }: VideoPlayerProps) {
  const { setActiveServer } = usePlayerStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  
  // Custom Player states
  const [isLoading, setIsLoading] = useState(true);
  const [isDirectStream, setIsDirectStream] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<StreamSubtitle[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string>('none');
  
  // Custom controls states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hlsRef = useRef<any>(null);

  // 1. Fetch server configs for iframe fallback
  useEffect(() => {
    fetch('/servers.json').then(r => r.json()).then(setServers).catch(() => {});
  }, []);

  // 2. Build the standard fallback embed url
  useEffect(() => {
    const server = servers.find(s => s.id === serverId) || servers[0];
    if (!server) return;
    const type = mediaType === 'anime' ? 'anime_sub' : mediaType === 'movie' ? 'movie' : 'tv';
    const url = buildEmbedUrl(server, { type, malId, tmdbId, episode, season });
    setEmbedUrl(url);
  }, [servers, serverId, malId, tmdbId, mediaType, episode, season]);

  // 3. Resolve Direct HLS Stream via Backend Aggregator
  useEffect(() => {
    let active = true;
    
    if (serverId !== 'omniflow_direct') {
      setIsDirectStream(false);
      setStreamUrl(null);
      setDownloadUrl(null);
      setSubtitles([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsDirectStream(false);
    setStreamUrl(null);
    setDownloadUrl(null);
    setSubtitles([]);
    
    const resolveDirectStream = async () => {
      try {
        const id = mediaType === 'anime' 
          ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`)
          : (mediaType === 'movie' ? `tmdb-movie-${tmdbId}` : `tmdb-tv-${tmdbId}`);
        
        const res = await fetch(`/api/stream?type=${mediaType}&id=${id}&episode=${episode}&season=${season}`);
        const data = await res.json();
        
        if (active) {
          if (data.success && data.url) {
            setStreamUrl(data.url);
            setDownloadUrl(data.downloadUrl || data.url);
            setSubtitles(data.subtitles || []);
            setIsDirectStream(true);
            
            // Set default active subtitle if available
            const defaultSub = data.subtitles?.find((s: any) => s.default);
            if (defaultSub) {
              setActiveSubtitle(defaultSub.lang);
            }
          } else {
            setIsDirectStream(false);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn('Backend stream aggregator resolution failed:', err);
        if (active) {
          setIsDirectStream(false);
          setIsLoading(false);
        }
      }
    };

    resolveDirectStream();
    return () => {
      active = false;
    };
  }, [mediaType, malId, tmdbId, episode, season, serverId]);

  // 4. Initialize Hls.js dynamically for .m3u8 streaming on non-native browsers
  useEffect(() => {
    if (!isDirectStream || !streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    
    // Cleanup previous hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (streamUrl.endsWith('.mp4')) {
      video.src = streamUrl;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple HLS (Safari/iOS)
      video.src = streamUrl;
    } else {
      // Use Hls.js dynamically loaded from CDN
      const initHls = () => {
        const Hls = (window as any).Hls;
        if (!Hls) return;

        const hls = new Hls({
          maxMaxBufferLength: 30,
          enableWorker: true
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.ERROR, function (event: any, data: any) {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setIsDirectStream(false); // Fallback to iframe on ultimate fatal crash
                break;
            }
          }
        });
      };

      if ((window as any).Hls) {
        initHls();
      } else {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';
        script.onload = initHls;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isDirectStream, streamUrl]);

  // 5. Custom Controls Logic handlers
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekVal = Number(e.target.value);
    videoRef.current.currentTime = seekVal;
    setCurrentTime(seekVal);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = Number(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !isMuted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // Listen to external exit-fullscreen events (e.g. Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mStr = String(m).padStart(2, '0');
    const sStr = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mStr}:${sStr}` : `${mStr}:${sStr}`;
  };

  const handleSpeedSelect = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  // Custom subtitle VTT tracks rendering logic
  const handleSubtitleSelect = (lang: string) => {
    setActiveSubtitle(lang);
    setShowSubtitleMenu(false);
    if (!videoRef.current) return;
    
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].language === lang) {
        tracks[i].mode = 'showing';
      } else {
        tracks[i].mode = 'disabled';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-void flex flex-col items-center justify-center border border-border">
        <LoadingSpinner size={48} />
        <p className="text-xs text-text-muted mt-4 font-medium uppercase tracking-widest animate-pulse">Aggregating stream links...</p>
      </div>
    );
  }

  // ─── DIRECT NATIVE HTML5 HLS VIDEO PLAYER ──────────────────────────────
  if (isDirectStream && streamUrl) {
    return (
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border group select-none cursor-pointer"
        onClick={handlePlayPause}
      >
        <video
          ref={videoRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
          playsInline
        >
          {/* Subtitles Track Injection */}
          {subtitles.map((sub, i) => (
            <track
              key={i}
              label={sub.label}
              src={sub.url}
              srcLang={sub.lang}
              kind="subtitles"
              default={sub.lang === activeSubtitle}
            />
          ))}
        </video>

        {/* Central Ambient Overlay play button */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-accent-green/20 backdrop-blur border border-accent-green/40 flex items-center justify-center text-accent-green scale-100 hover:scale-105 transition-transform duration-300">
              <Play size={28} className="fill-accent-green ml-1" />
            </div>
          </div>
        )}

        {/* Custom Premium Glassmorphic Controls Bar */}
        <div 
          onClick={(e) => e.stopPropagation()} // Prevent click through playing/pausing
          className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 flex flex-col gap-2 transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {/* Top Progress Seek Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold font-mono text-text-muted">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-accent-green hover:h-1.5 transition-all outline-none"
            />
            <span className="text-[10px] font-bold font-mono text-text-muted">{formatTime(duration)}</span>
          </div>

          {/* Bottom Action Control row */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-4">
              {/* Play / Pause */}
              <button 
                onClick={handlePlayPause}
                className="text-white hover:text-accent-green transition-colors cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} className="fill-white" /> : <Play size={18} className="fill-white ml-0.5" />}
              </button>

              {/* Volume Slider Toggle */}
              <div className="flex items-center gap-2 group/volume">
                <button 
                  onClick={toggleMute}
                  className="text-white hover:text-accent-green transition-colors cursor-pointer"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white group-hover/volume:w-20 transition-all outline-none"
                />
              </div>

              {/* Live Direct Stream Tag */}
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-green/10 border border-accent-green/20 rounded text-[9px] font-bold uppercase text-accent-green tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                Direct Stream
              </span>
            </div>

            {/* Right side controllers */}
            <div className="flex items-center gap-4 relative">
              {/* Direct Download utility */}
              {downloadUrl && (
                <a 
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-accent-green transition-colors cursor-pointer p-1"
                  title="Download Video File (.mp4/.m3u8)"
                >
                  <Download size={18} />
                </a>
              )}

              {/* Subtitles Button Menu */}
              {subtitles.length > 0 && (
                <div className="relative">
                  <button 
                    onClick={() => {
                      setShowSubtitleMenu(!showSubtitleMenu);
                      setShowSpeedMenu(false);
                    }}
                    className={`hover:text-accent-green transition-colors cursor-pointer p-1 ${showSubtitleMenu || activeSubtitle !== 'none' ? 'text-accent-green' : 'text-white'}`}
                    title="Subtitles/Captions"
                  >
                    <Subtitles size={18} />
                  </button>
                  
                  {showSubtitleMenu && (
                    <div className="absolute bottom-10 right-0 z-30 bg-void border border-border/80 rounded-xl p-1 shadow-2xl min-w-[120px] backdrop-blur-md overflow-hidden">
                      <button 
                        onClick={() => handleSubtitleSelect('none')}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs font-bold transition-colors ${activeSubtitle === 'none' ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-surface'}`}
                      >
                        Off
                      </button>
                      {subtitles.map((sub, idx) => (
                        <button 
                          key={idx}
                          onClick={() => handleSubtitleSelect(sub.lang)}
                          className={`w-full text-left px-3 py-1.5 rounded text-xs font-bold transition-colors ${activeSubtitle === sub.lang ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-surface'}`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Speed Menu Toggler */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowSubtitleMenu(false);
                  }}
                  className="text-white hover:text-accent-green transition-colors cursor-pointer p-1"
                  title="Playback Speed"
                >
                  <Settings size={18} />
                </button>

                {showSpeedMenu && (
                  <div className="absolute bottom-10 right-0 z-30 bg-void border border-border/80 rounded-xl p-1 shadow-2xl min-w-[90px] backdrop-blur-md overflow-hidden">
                    {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedSelect(rate)}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs font-bold transition-colors ${playbackRate === rate ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-surface'}`}
                      >
                        {rate === 1 ? 'Normal' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fullscreen Button */}
              <button 
                onClick={toggleFullscreen}
                className="text-white hover:text-accent-green transition-colors cursor-pointer p-1"
                title="Fullscreen Toggle"
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── PREMIUM DIRECT RESOLUTION OFFLINE STATE ──────────────────────────
  if (serverId === 'omniflow_direct' && !isDirectStream && !isLoading) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-void border border-border shadow-2xl flex flex-col items-center justify-center p-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-br from-void via-surface/10 to-void opacity-50 pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center mx-auto animate-pulse">
            <AlertCircle size={22} className="text-accent-green" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase font-display">Premium Scraper Offline</h3>
            <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
              We couldn&apos;t resolve a high-speed direct CDN stream for this episode. Rotate to our redundant backup server?
            </p>
          </div>
          <button
            onClick={() => setActiveServer('vidsrc_to')}
            className="w-full bg-accent-green text-black font-bold text-xs py-2.5 px-4 rounded-xl hover:bg-white hover:text-black transition-all cursor-pointer shadow-lg shadow-accent-green/15 uppercase tracking-wider font-display"
          >
            Connect to Backup Server
          </button>
        </div>
      </div>
    );
  }

  // ─── SECURE RESILIENT SANDBOXED IFRAME FALLBACK ───────────────────────
  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border shadow-2xl">
      {embedUrl ? (
        <iframe
          src={embedUrl}
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation"
          allowFullScreen
          className="w-full h-full"
          title="Video Player Sandbox"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-void text-center">
          <AlertCircle size={32} className="text-[#E69D37]" />
          <p className="text-xs text-[#E69D37] mt-3 font-semibold uppercase tracking-wider">No Server Connections Connected</p>
          <p className="text-[10px] text-text-muted mt-1 max-w-xs">Configuring backup channels. Try manual server switcher option below.</p>
        </div>
      )}
    </div>
  );
}
