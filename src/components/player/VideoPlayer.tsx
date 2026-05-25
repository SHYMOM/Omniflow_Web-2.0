'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  Settings, Download, RotateCcw, AlertCircle, Info, Subtitles, Mic 
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

interface HlsQualityLevel {
  height: number;
  bitrate: number;
}

interface HlsAudioTrack {
  id: number;
  name: string;
  language: string;
}

export default function VideoPlayer({ malId, tmdbId, mediaType, episode, season, serverId }: VideoPlayerProps) {
  const { setActiveServer, setDownloadUrl, setAvailableLanguages } = usePlayerStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  
  // Custom Player states
  const [isLoading, setIsLoading] = useState(true);
  const [isDirectStream, setIsDirectStream] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<StreamSubtitle[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string>('none');
  const [backendLangs, setBackendLangs] = useState<string[]>(['sub']);
  
  // HLS states
  const [hlsLevels, setHlsLevels] = useState<HlsQualityLevel[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(-1); // -1 = Auto
  const [audioTracks, setAudioTracks] = useState<HlsAudioTrack[]>([]);
  const [currentAudioTrackId, setCurrentAudioTrackId] = useState<number>(-1);
  
  // Custom controls states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  // Menus
  const [activeMenu, setActiveMenu] = useState<'speed' | 'quality' | 'audio' | 'subtitles' | null>(null);
  const [language, setLanguage] = useState<'sub' | 'eng' | 'hin'>('sub');

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
    setHlsLevels([]);
    setAudioTracks([]);
    
    const resolveDirectStream = async () => {
      try {
        const id = mediaType === 'anime' 
          ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`)
          : (mediaType === 'movie' ? `tmdb-movie-${tmdbId}` : `tmdb-tv-${tmdbId}`);
        
        const dubbedParam = language !== 'sub' ? '&dubbed=true' : '';
        const langParam = `&lang=${language}`;
        const res = await fetch(`/api/stream?type=${mediaType}&id=${id}&episode=${episode}&season=${season}${dubbedParam}${langParam}`);
        const data = await res.json();
        
        if (active) {
          if (data.success && data.url) {
            setStreamUrl(data.url);
            setDownloadUrl(data.downloadUrl || data.url);
            setSubtitles(data.subtitles || []);
            setIsDirectStream(true);
            
            // Backend provides available languages for hardcoded streams
            if (data.availableLanguages) {
               setBackendLangs(data.availableLanguages);
               setAvailableLanguages(data.availableLanguages);
            }
            
            const defaultSub = data.subtitles?.find((s: any) => s.default);
            if (defaultSub) setActiveSubtitle(defaultSub.lang);
          } else {
            setIsDirectStream(false);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setIsDirectStream(false);
          setIsLoading(false);
        }
      }
    };

    resolveDirectStream();
    return () => { active = false; };
  }, [mediaType, malId, tmdbId, episode, season, serverId, language, setDownloadUrl, setAvailableLanguages]);

  // 4. Initialize Hls.js dynamically for .m3u8 streaming
  useEffect(() => {
    if (!isDirectStream || !streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (streamUrl.includes('.mp4') || (streamUrl.includes('ext=.mp4'))) {
      video.src = streamUrl;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    } else {
      const initHls = () => {
        const Hls = (window as any).Hls;
        if (!Hls) return;

        const hls = new Hls({ maxMaxBufferLength: 30, enableWorker: true });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (event: any, data: any) => {
          setHlsLevels(data.levels);
          
          // Native multi-audio tracks extraction
          if (hls.audioTracks && hls.audioTracks.length > 1) {
             setAudioTracks(hls.audioTracks);
             setAvailableLanguages(hls.audioTracks.map((t: any) => t.language || t.name));
          }
          
          // Native embedded subtitle tracks extraction
          if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
             const hlsSubs = hls.subtitleTracks.map((track: any) => ({
               label: track.name || track.language || 'Subtitle',
               lang: `hls-${track.id}`,
               url: '',
               default: track.default
             }));
             setSubtitles((prev) => {
               // Avoid duplicating if we remount
               const newSubs = [...prev];
               hlsSubs.forEach((hsub: any) => {
                 if (!newSubs.find(s => s.lang === hsub.lang)) newSubs.push(hsub);
               });
               return newSubs;
             });
             
             const defaultTrack = hls.subtitleTracks.find((t: any) => t.default);
             if (defaultTrack) {
               setActiveSubtitle(`hls-${defaultTrack.id}`);
               hls.subtitleTrack = defaultTrack.id;
             }
          }
        });

        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setIsDirectStream(false);
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
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [isDirectStream, streamUrl, setAvailableLanguages]);

  // 5. Controls Logic
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play().catch(() => {});
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
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) containerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setActiveMenu(null);
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

  // Switch Quality (HLS levels)
  const handleQualitySelect = (index: number) => {
    if (!hlsRef.current) return;
    // nextLevel avoids jarring transitions, smoothly adapting at next fragment
    hlsRef.current.nextLevel = index;
    setCurrentLevelIndex(index);
    setActiveMenu(null);
  };

  // Switch Audio Track (Native HLS)
  const handleAudioTrackSelect = (id: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.audioTrack = id;
    setCurrentAudioTrackId(id);
    setActiveMenu(null);
  };

  const handleSubtitleSelect = (lang: string) => {
    setActiveSubtitle(lang);
    setActiveMenu(null);
    
    if (lang.startsWith('hls-')) {
      if (hlsRef.current) {
         hlsRef.current.subtitleTrack = parseInt(lang.replace('hls-', ''), 10);
      }
      // Disable external tracks
      if (videoRef.current) {
        const tracks = videoRef.current.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
      }
      return;
    }

    if (hlsRef.current) {
       hlsRef.current.subtitleTrack = -1; // disable hls native sub
    }
    
    if (!videoRef.current) return;
    
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = tracks[i].language === lang ? 'showing' : 'disabled';
    }
  };

  const toggleMenu = (menu: 'speed' | 'quality' | 'audio' | 'subtitles') => {
    setActiveMenu(activeMenu === menu ? null : menu);
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
      <div className="flex flex-col w-full h-full group/player relative font-sans">
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          className="relative w-full flex-1 min-h-0 aspect-video overflow-hidden bg-black select-none"
          onClick={(e) => {
            if ((e.target as HTMLElement).tagName !== 'BUTTON' && activeMenu === null) {
              handlePlayPause();
            } else {
              setActiveMenu(null);
            }
          }}
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
            {subtitles.map((sub, i) => (
              <track key={i} label={sub.label} src={sub.url} srcLang={sub.lang} kind="subtitles" default={sub.lang === activeSubtitle} />
            ))}
          </video>

          {!isPlaying && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity pointer-events-none z-10">
              <div className="w-20 h-20 rounded-full bg-accent-green/20 backdrop-blur-md border border-accent-green/50 flex items-center justify-center text-accent-green scale-100 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(0,230,118,0.3)]">
                <Play size={36} className="fill-accent-green ml-2" />
              </div>
            </div>
          )}

          {/* Premium Glassmorphic Controls Bar */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pt-24 pb-4 px-4 flex flex-col gap-3 transition-all duration-300 ease-out ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {/* Top Progress Seek Bar */}
            <div className="flex items-center gap-3 w-full group/seek">
              <span className="text-[11px] font-medium font-mono text-white/80">{formatTime(currentTime)}</span>
              <div className="relative flex-1 h-1.5 flex items-center">
                 <input
                   type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek}
                   className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                 />
                 <div className="absolute w-full h-1 bg-white/20 rounded-full overflow-hidden transition-all group-hover/seek:h-1.5">
                   <div className="h-full bg-accent-green relative shadow-[0_0_10px_rgba(0,230,118,0.8)]" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
                 </div>
              </div>
              <span className="text-[11px] font-medium font-mono text-white/80">{formatTime(duration)}</span>
            </div>

            {/* Bottom Action Control row */}
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-4">
                <button onClick={handlePlayPause} className="text-white hover:text-accent-green transition-colors cursor-pointer" title={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <Pause size={22} className="fill-white" /> : <Play size={22} className="fill-white ml-0.5" />}
                </button>

                <div className="flex items-center gap-2 group/volume">
                  <button onClick={toggleMute} className="text-white hover:text-accent-green transition-colors cursor-pointer">
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                    className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white transition-all outline-none"
                  />
                </div>

                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-accent-green/10 border border-accent-green/20 rounded text-[9px] font-bold uppercase text-accent-green tracking-wider shadow-[0_0_10px_rgba(0,230,118,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" /> Direct
                </span>
              </div>

              {/* Right side controllers */}
              <div className="flex items-center gap-4 relative">
                
                {/* Audio Language Switcher */}
                <div className="relative">
                  <button 
                    onClick={() => (audioTracks.length > 1 || backendLangs.length > 1) && toggleMenu('audio')}
                    disabled={audioTracks.length <= 1 && backendLangs.length <= 1}
                    className={`hover:text-accent-green transition-colors p-1 font-bold text-xs uppercase tracking-wider ${activeMenu === 'audio' ? 'text-accent-green' : 'text-white'} ${(audioTracks.length <= 1 && backendLangs.length <= 1) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    title="Audio Language"
                  >
                    <Mic size={14} className="inline mr-1 mb-0.5" />
                    {audioTracks.length > 1 && currentAudioTrackId > -1 
                      ? audioTracks.find(t => t.id === currentAudioTrackId)?.name?.slice(0,3) || 'Audio'
                      : (backendLangs.length > 1 ? language : 'Audio')}
                  </button>
                  {activeMenu === 'audio' && (audioTracks.length > 1 || backendLangs.length > 1) && (
                    <div className="absolute bottom-10 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[120px]">
                      {audioTracks.length > 1 ? (
                        audioTracks.map((track) => (
                          <button key={track.id} onClick={() => handleAudioTrackSelect(track.id)} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${currentAudioTrackId === track.id ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                            {track.name || track.language}
                          </button>
                        ))
                      ) : (
                        backendLangs.map((langOpt) => (
                          <button key={langOpt} onClick={() => { setLanguage(langOpt as any); setActiveMenu(null); }} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${language === langOpt ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                            {langOpt === 'sub' ? 'Japanese (Sub)' : langOpt === 'eng' ? 'English (Dub)' : langOpt === 'hin' ? 'Hindi (Dub)' : langOpt}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Subtitles Menu */}
                <div className="relative">
                  <button 
                    onClick={() => subtitles.length > 0 && toggleMenu('subtitles')}
                    disabled={subtitles.length === 0}
                    className={`hover:text-accent-green transition-colors p-1.5 ${activeMenu === 'subtitles' || activeSubtitle !== 'none' ? 'text-accent-green' : 'text-white'} ${subtitles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} 
                    title="Subtitles"
                  >
                    <Subtitles size={20} />
                  </button>
                  {activeMenu === 'subtitles' && subtitles.length > 0 && (
                    <div className="absolute bottom-12 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[140px] max-h-60 overflow-y-auto">
                      <button onClick={() => handleSubtitleSelect('none')} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${activeSubtitle === 'none' ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>Off</button>
                      {subtitles.map((sub, idx) => (
                        <button key={idx} onClick={() => handleSubtitleSelect(sub.lang)} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${activeSubtitle === sub.lang ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>{sub.label}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quality Selection (HLS Levels) */}
                {hlsLevels.length > 0 && (
                  <div className="relative">
                    <button onClick={() => toggleMenu('quality')} className={`hover:text-accent-green transition-colors cursor-pointer p-1 font-bold text-xs ${activeMenu === 'quality' ? 'text-accent-green' : 'text-white'}`} title="Quality">
                      {currentLevelIndex === -1 ? 'Auto' : `${hlsLevels[currentLevelIndex]?.height}p`}
                    </button>
                    {activeMenu === 'quality' && (
                      <div className="absolute bottom-10 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[100px]">
                        <button onClick={() => handleQualitySelect(-1)} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${currentLevelIndex === -1 ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>Auto</button>
                        {[...hlsLevels].reverse().map((level, idx) => {
                          const originalIndex = hlsLevels.length - 1 - idx;
                          return (
                            <button key={originalIndex} onClick={() => handleQualitySelect(originalIndex)} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${currentLevelIndex === originalIndex ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                              {level.height}p
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Speed Selector (up to 3x) */}
                <div className="relative">
                  <button onClick={() => toggleMenu('speed')} className={`hover:text-accent-green transition-colors cursor-pointer p-1.5 ${activeMenu === 'speed' ? 'text-accent-green' : 'text-white'}`} title="Speed">
                    <Settings size={20} />
                  </button>
                  {activeMenu === 'speed' && (
                    <div className="absolute bottom-12 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[100px]">
                      {[0.5, 1, 1.25, 1.5, 2, 2.5, 3].map((rate) => (
                        <button key={rate} onClick={() => { if(videoRef.current) videoRef.current.playbackRate = rate; setPlaybackRate(rate); setActiveMenu(null); }} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${playbackRate === rate ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                          {rate === 1 ? 'Normal' : `${rate}x`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={toggleFullscreen} className="text-white hover:text-accent-green transition-colors cursor-pointer p-1.5 ml-2" title="Fullscreen">
                  {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (serverId === 'omniflow_direct' && !isDirectStream && !isLoading) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-void border border-border flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-accent-green/10 border border-accent-green/30 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={22} className="text-accent-green" />
        </div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Premium Scraper Offline</h3>
        <p className="text-xs text-text-muted mt-2 max-w-sm mb-4">We couldn&apos;t resolve a high-speed stream. Try a backup server.</p>
        <button onClick={() => setActiveServer('vidsrc_to')} className="bg-accent-green text-black font-bold text-xs py-2 px-4 rounded-lg cursor-pointer">
          Use Backup Embed
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border">
      {embedUrl ? (
        <iframe src={embedUrl} sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" allowFullScreen className="w-full h-full" title="Video Player" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-void text-center"><AlertCircle size={32} className="text-text-muted" /></div>
      )}
    </div>
  );
}
