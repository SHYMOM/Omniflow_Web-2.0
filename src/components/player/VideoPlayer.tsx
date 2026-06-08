'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  Settings, Download, RotateCcw, RotateCw, AlertCircle, Info, Subtitles, Mic,
  ListVideo, PictureInPicture, Monitor, MonitorPlay, Cast
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePlayerStore } from '@/store/playerStore';
import { useUserStore } from '@/store/userStore';
import GoogleImaAdPlayer from './GoogleImaAdPlayer';
import DownloadModal from './DownloadModal';

interface VideoPlayerProps {
  malId: number;
  tmdbId: number;
  mediaType: string;
  episode: number;
  season: number;
  serverId?: string; // Kept for prop compatibility, but ignored
  mediaTitle?: string;
  imdbId?: string;
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

// Deduplicate subtitles by URL and ensure unique language codes
function getUniqueSubtitles(subs: StreamSubtitle[]): StreamSubtitle[] {
  const uniqueByUrl: StreamSubtitle[] = [];
  const urlsSeen = new Set<string>();
  
  subs.forEach(s => {
    if (s.url) {
      if (!urlsSeen.has(s.url)) {
        urlsSeen.add(s.url);
        uniqueByUrl.push(s);
      }
    } else {
      uniqueByUrl.push(s);
    }
  });

  const langCounts = new Map<string, number>();
  return uniqueByUrl.map(s => {
    const baseLang = s.lang || 'sub';
    let count = langCounts.get(baseLang) || 0;
    count++;
    langCounts.set(baseLang, count);
    
    return {
      ...s,
      lang: count === 1 ? baseLang : `${baseLang}-${count}`
    };
  });
}

export default function VideoPlayer({ malId, tmdbId, mediaType, episode, season, mediaTitle, imdbId }: VideoPlayerProps) {
  const { 
    setActiveServer, setDownloadUrl, setAvailableLanguages,
    availableStreams, setAvailableStreams,
    externalSubtitles, setExternalSubtitles,
    currentLanguage, setCurrentLanguage, downloadUrl,
    isDownloadModalOpen, setIsDownloadModalOpen,
    hotSwapToast, setHotSwapToast,
    failedStreamUrls, addFailedStreamUrl, clearFailedStreamUrls
  } = usePlayerStore();
  
  const { subtitleSettings, settings } = useUserStore();
  
  // Custom Player states
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [adActive, setAdActive] = useState(false);
  const [adFinished, setAdFinished] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<StreamSubtitle[]>([]);
  const [activeSubtitle, setActiveSubtitle] = useState<string>('none');
  const [backendLangs, setBackendLangs] = useState<string[]>(['sub']);
  const [hasFatalError, setHasFatalError] = useState(false);
  
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
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const [activeMenu, setActiveMenu] = useState<'speed' | 'quality' | 'audio' | 'subtitles' | null>(null);
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [loadingText, setLoadingText] = useState('Resolving premium streams...');

  // Hot swap persistence
  const hotSwapTimeRef = useRef<number | null>(null);
  const hotSwapRateRef = useRef<number>(1);
  const hotSwapVolumeRef = useRef<number>(1);
  const loadedKeyRef = useRef<string | null>(null);
  const hotSwapToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNativeSwitchRef = useRef<boolean>(false);

  // Hover Preview States
  const [isHoveringSeek, setIsHoveringSeek] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverPosition, setHoverPosition] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hlsRef = useRef<any>(null);
  const hlsRetryCountRef = useRef<number>(0);
  const HLS_MAX_RETRIES = 3;

  const [resolvedTmdbId, setResolvedTmdbId] = useState<number | null>(tmdbId);

  // Auto-Fallback Engine: Tries the NEXT stream of the SAME language if one fails
  const attemptAutoFallback = useCallback(() => {
    const state = usePlayerStore.getState();
    const streams = state.availableStreams;
    const failedUrls = state.failedStreamUrls;

    const currentUrl = streamUrl;
    if (currentUrl) state.addFailedStreamUrl(currentUrl);

    // Try to find another stream in the SAME language that hasn't failed yet
    const fallbackStreamSameLang = streams.find(
      s => s.sourceUrl !== currentUrl && !failedUrls.has(s.sourceUrl) && s.language === state.currentLanguage
    );

    if (fallbackStreamSameLang) {
      setHotSwapToast(`Stream error, transparently switching source...`);
      handleHotSwap(fallbackStreamSameLang.language, fallbackStreamSameLang.sourceUrl);
      return true;
    }

    // If no same-language stream exists, try a DIFFERENT language fallback
    const fallbackStreamDiffLang = streams.find(
      s => s.sourceUrl !== currentUrl && !failedUrls.has(s.sourceUrl)
    );

    if (fallbackStreamDiffLang) {
      const currentLangName = getLanguageName(state.currentLanguage);
      const fallbackLangName = getLanguageName(fallbackStreamDiffLang.language);
      setHotSwapToast(`${currentLangName} unavailable — switching to ${fallbackLangName}...`);
      handleHotSwap(fallbackStreamDiffLang.language, fallbackStreamDiffLang.sourceUrl);
      return true;
    }

    return false; // Complete failure
  }, [streamUrl]);

  const handleHotSwap = useCallback((lang: string, url: string) => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    hotSwapTimeRef.current = video.currentTime;
    hotSwapRateRef.current = video.playbackRate || 1;
    hotSwapVolumeRef.current = video.volume;

    const langName = getLanguageName(lang);
    setHotSwapToast(`Switching to ${langName}...`);
    if (hotSwapToastTimerRef.current) clearTimeout(hotSwapToastTimerRef.current);
    hotSwapToastTimerRef.current = setTimeout(() => setHotSwapToast(null), 4000);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setCurrentLanguage(lang);
    setActiveMenu(null);
    setIsLoading(true);
    setStreamUrl(url);
  }, [setCurrentLanguage, setHotSwapToast]);

  // 1. Fetch real TMDB ID for Anime
  useEffect(() => {
    if (mediaType === 'anime' && malId) {
      fetch(`https://arm.haglund.dev/api/v2/ids?source=myanimelist&id=${malId}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.themoviedb) setResolvedTmdbId(Number(data.themoviedb));
        })
        .catch(console.error);
    } else {
      setResolvedTmdbId(tmdbId);
    }
  }, [mediaType, malId, tmdbId]);

  // 2. Resolve Direct Stream
  useEffect(() => {
    if (isNativeSwitchRef.current) {
      isNativeSwitchRef.current = false;
      return;
    }

    let active = true;
    const id = mediaType === 'anime' 
      ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`)
      : (mediaType === 'movie' ? `tmdb-movie-${tmdbId}` : `tmdb-tv-${tmdbId}`);
    
    const currentKey = `${id}:${episode}:${season}`;

    if (loadedKeyRef.current === currentKey && availableStreams.length > 0) {
      // Find best un-failed stream for this language
      const match = availableStreams.find(s => s.language === currentLanguage && !failedStreamUrls.has(s.sourceUrl));
      if (match) {
        setStreamUrl(match.sourceUrl);
        setIsLoading(false);
        return () => { active = false; };
      }
    }

    setIsLoading(true);
    setAdActive(true);
    setAdFinished(false);
    setPlaybackReady(false);
    setStreamUrl(null);
    setDownloadUrl(null);
    setSubtitles([]);
    setHlsLevels([]);
    clearFailedStreamUrls();
    setAudioTracks([]);
    setHasFatalError(false);
    
    const resolveDirectStream = async () => {
      try {
        const dubbedParam = currentLanguage !== 'sub' ? '&dubbed=true' : '';
        const langParam = `&lang=${currentLanguage}`;
        const titleParam = mediaTitle ? `&title=${encodeURIComponent(mediaTitle)}` : '';
        const imdbParam = imdbId ? `&imdbId=${imdbId}` : '';
        
        const res = await fetch(`/api/stream?type=${mediaType}&id=${id}&episode=${episode}&season=${season}${dubbedParam}${langParam}${titleParam}${imdbParam}`);
        const data = await res.json();
        
        if (active) {
          if (data.success && data.url) {
            setStreamUrl(data.url);
            setDownloadUrl(data.downloadUrl || data.url);
            const uniqueSubs = data.subtitles ? getUniqueSubtitles(data.subtitles) : [];
            setSubtitles(uniqueSubs);
            loadedKeyRef.current = currentKey;
            
            if (data.availableStreams && data.availableStreams.length > 0) {
              setAvailableStreams(data.availableStreams);
            }
            if (data.availableLanguages && data.availableLanguages.length > 0) {
               setBackendLangs(data.availableLanguages);
               setAvailableLanguages(data.availableLanguages);
            }
            
            const defaultSub = uniqueSubs.find((s: any) => s.default);
            if (defaultSub) setActiveSubtitle(defaultSub.lang);
          } else {
            if (currentLanguage !== 'sub') {
              console.warn(`Dub not found! Switching back to sub...`);
              setCurrentLanguage('sub');
              return;
            } else {
              setHasFatalError(true);
            }
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          setHasFatalError(true);
          setIsLoading(false);
        }
      }
    };

    resolveDirectStream();
    return () => { active = false; };
  }, [mediaType, malId, tmdbId, episode, season, currentLanguage, mediaTitle]);

  // 3. Initialize HLS
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = streamUrl.includes('format=m3u8') || (streamUrl.includes('.m3u8') && !streamUrl.includes('format=mp4'));
    
    const tryPlay = () => {
      setPlaybackReady(true);
      if (adActive) return;
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    };

    if (!isHls) {
      video.src = streamUrl;
      if (hotSwapTimeRef.current !== null) {
        video.currentTime = hotSwapTimeRef.current;
        hotSwapTimeRef.current = null;
      }
      tryPlay();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      if (hotSwapTimeRef.current !== null) {
        video.currentTime = hotSwapTimeRef.current;
        hotSwapTimeRef.current = null;
      }
      tryPlay();
    } else {
      const initHls = () => {
        const Hls = (window as any).Hls;
        if (!Hls) return;

        hlsRetryCountRef.current = 0;

        const hls = new Hls({
          maxMaxBufferLength: 30,
          enableWorker: true,
          fragLoadPolicy: {
            default: { maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 30000, timeoutRetry: { maxNumRetry: 4, retryDelayMs: 1000, maxRetryDelayMs: 8000 }, errorRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000 } }
          },
          manifestLoadPolicy: {
            default: { maxTimeToFirstByteMs: 10000, maxLoadTimeMs: 20000, timeoutRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 4000 }, errorRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 4000 } }
          },
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (event: any, data: any) => {
          setHlsLevels(data.levels);
          if (hotSwapTimeRef.current !== null && video) {
            video.currentTime = hotSwapTimeRef.current;
            hotSwapTimeRef.current = null;
          }
          if (hotSwapRateRef.current !== 1 && video) {
            video.playbackRate = hotSwapRateRef.current;
          }
          if (hotSwapVolumeRef.current !== undefined && video) {
            video.volume = hotSwapVolumeRef.current;
          }
          setHotSwapToast(null);
          tryPlay();
          
          if (hls.audioTracks && hls.audioTracks.length > 1) {
             setAudioTracks(hls.audioTracks);
             setAvailableLanguages(hls.audioTracks.map((t: any) => t.language || t.name));
          }
        });

        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          if (data.fatal) {
            console.warn(`[HLS] Fatal error type=${data.type} details=${data.details} retry=${hlsRetryCountRef.current}/${HLS_MAX_RETRIES}`);
            
            const statusCode = data.response?.code;
            if (statusCode === 403 || statusCode === 500 || data.details === 'manifestLoadError') {
                if (!attemptAutoFallback()) setHasFatalError(true);
                return;
            }
            
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (hlsRetryCountRef.current < HLS_MAX_RETRIES) {
                  hlsRetryCountRef.current++;
                  hls.startLoad();
                } else {
                  if (!attemptAutoFallback()) setHasFatalError(true);
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                if (hlsRetryCountRef.current < HLS_MAX_RETRIES) {
                  hlsRetryCountRef.current++;
                  hls.recoverMediaError();
                } else {
                  if (!attemptAutoFallback()) setHasFatalError(true);
                }
                break;
              default:
                if (!attemptAutoFallback()) setHasFatalError(true);
                break;
            }
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          hlsRetryCountRef.current = 0;
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
  }, [streamUrl, attemptAutoFallback]);

  // 4. Ad overlay completion
  useEffect(() => {
    if (adActive && adFinished) {
      if (isPlaying) {
        setAdActive(false);
        setAdFinished(false);
      } else {
        if (playbackReady && videoRef.current) {
          videoRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(() => {
              setAdActive(false);
              setAdFinished(false);
            });
        }
        const timer = setTimeout(() => {
          setAdActive(false);
          setAdFinished(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [adActive, adFinished, isPlaying, playbackReady]);

  // Handle external subtitles effect
  useEffect(() => {
    if (externalSubtitles && externalSubtitles.length > 0) {
      setSubtitles(prev => {
        const merged = [...prev];
        externalSubtitles.forEach(ext => {
          if (!merged.find(s => s.url === ext.url)) {
            merged.push({ label: ext.lang, lang: ext.lang, url: ext.url, default: false });
          }
        });
        return getUniqueSubtitles(merged);
      });
    }
  }, [externalSubtitles]);

  // Subtitle track selection
  useEffect(() => {
    if (!videoRef.current) return;
    
    const timer = setTimeout(() => {
      if (!videoRef.current) return;
      
      const tracks = videoRef.current.textTracks;
      
      if (activeSubtitle.startsWith('hls-')) {
        for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'disabled';
        if (hlsRef.current) hlsRef.current.subtitleTrack = parseInt(activeSubtitle.replace('hls-', ''), 10);
      } else if (activeSubtitle === 'none') {
        for (let i = 0; i < tracks.length; i++) tracks[i].mode = 'disabled';
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
      } else {
        if (hlsRef.current) hlsRef.current.subtitleTrack = -1;
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = tracks[i].language === activeSubtitle ? 'showing' : 'disabled';
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSubtitle, subtitles, streamUrl]);

  // Controls Logic
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, []);

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(
      Math.max(0, videoRef.current.currentTime + seconds), 
      videoRef.current.duration || 0
    );
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

  // Fixed Hover Math
  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.nativeEvent.offsetX) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    setHoverPosition(clampedPos);
    setHoverTime(clampedPos * duration);
    setIsHoveringSeek(true);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = Number(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else {
        await videoRef.current.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.warn("PiP not supported or failed", err);
    }
  }, []);

  useEffect(() => {
    const handleFs = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!!document.fullscreenElement) setIsTheaterMode(false); // Disable theater when entering true FS
    };
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (adActive || !videoRef.current) return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)) return;

      const video = videoRef.current;
      switch (e.key) {
        case ' ':
        case 'Spacebar':
        case 'k':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
        case 'j':
          e.preventDefault();
          handleSkip(-10);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          handleSkip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          const newVolUp = Math.min(1, video.volume + 0.1);
          video.volume = newVolUp;
          setVolume(newVolUp);
          break;
        case 'ArrowDown':
          e.preventDefault();
          const newVolDown = Math.max(0, video.volume - 0.1);
          video.volume = newVolDown;
          setVolume(newVolDown);
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          setIsTheaterMode(prev => !prev);
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePiP();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [adActive, handlePlayPause, toggleMute, toggleFullscreen, togglePiP]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setActiveMenu(null);
      }
    }, 2500);
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

  const toggleMenu = (menu: 'speed' | 'quality' | 'audio' | 'subtitles') => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const getLanguageName = (code: string) => {
    if (!code || code === 'und' || code === 'unknown') return 'Original Language';
    if (code === 'sub') return 'Original Language';
    if (code === 'eng' || code === 'eng-dub') return 'English (Dub)';
    if (code === 'hin' || code === 'hin-dub') return 'Hindi (Dub)';
    try {
      const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
      const name = displayNames.of(code);
      return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Original Language';
    } catch {
      return 'Original Language';
    }
  };

  if (hasFatalError) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black flex flex-col items-center justify-center font-sans text-center px-4">
        <AlertCircle size={48} className="text-red-500 mb-4 opacity-80" />
        <h2 className="text-white font-bold text-lg mb-2">Stream Unavailable</h2>
        <p className="text-text-muted text-sm max-w-md">We couldn't extract a raw video stream for this media. Our scrapers might be blocked or the media has been taken down from our partner servers.</p>
      </div>
    );
  }

  return (
    <div className={`relative transition-all duration-300 ease-in-out ${isTheaterMode ? 'fixed inset-0 z-[100] w-full h-[100dvh] bg-black' : 'w-full aspect-video rounded-xl overflow-hidden bg-black border border-border/50 shadow-2xl'}`}>
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className="relative w-full h-full flex-1 min-h-0 overflow-hidden bg-black select-none group/player"
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName !== 'BUTTON' && activeMenu === null) {
            handlePlayPause();
          } else {
            setActiveMenu(null);
          }
        }}
      >
        {subtitleSettings && (
          <style>
            {`
              video::cue {
                font-family: ${subtitleSettings.fontFamily || 'Inter'}, sans-serif;
                font-size: ${subtitleSettings.fontSize || 32}px;
                color: ${subtitleSettings.fontColor || '#ffffff'};
                background-color: ${subtitleSettings.backgroundColor || '#000000'}${Math.floor((subtitleSettings.backgroundOpacity ?? 0.5) * 255).toString(16).padStart(2, '0')};
                text-shadow: ${(subtitleSettings.outlineWidth || 0) > 0 
                    ? "0 0 " + subtitleSettings.outlineWidth + "px " + (subtitleSettings.outlineColor || '#000') + ", 0 0 " + subtitleSettings.outlineWidth + "px " + (subtitleSettings.outlineColor || '#000')
                    : 'none'
                };
              }
            `}
          </style>
        )}

        <video
          key={streamUrl || 'empty'}
          ref={videoRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onCanPlay={() => { setPlaybackReady(true); setIsBuffering(false); }}
          onError={(e) => {
            console.error('Native video error:', e);
            if (!attemptAutoFallback()) setHasFatalError(true);
          }}
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
          playsInline
        >
          {subtitles.filter(sub => sub.url && !sub.lang.startsWith('hls-')).map((sub, i) => (
            <track key={i} label={sub.label} src={sub.url} srcLang={sub.lang} kind="subtitles" default={sub.lang === activeSubtitle} />
          ))}
        </video>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-30">
            <LoadingSpinner size={48} />
            <span className="text-xs text-white mt-4 font-bold uppercase tracking-widest animate-pulse">{loadingText}</span>
          </div>
        )}

        {/* Buffering Overlay */}
        {isBuffering && !adActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 pointer-events-none">
            <LoadingSpinner size={48} />
          </div>
        )}

        {/* Center Play Button (when paused) */}
        {!isPlaying && !isLoading && !adActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity pointer-events-none z-10">
            <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white scale-100 group-hover/player:scale-110 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
              <Play size={36} className="fill-white ml-2" />
            </div>
          </div>
        )}

        {/* Hot-Swap Toast */}
        {hotSwapToast && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
              <RotateCcw size={14} className="text-white animate-spin" />
              <span className="text-xs font-bold text-white tracking-wide">{hotSwapToast}</span>
            </div>
          </div>
        )}

        {/* Top Gradient (for Title / Theater Mode indicator) */}
        <div className={`absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/80 to-transparent z-40 transition-opacity duration-300 pointer-events-none ${showControls && !adActive ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between p-4 px-6 w-full">
            <span className="text-white font-bold text-sm drop-shadow-md">{mediaTitle || 'Playing...'}</span>
            {isTheaterMode && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsTheaterMode(false); }}
                className="pointer-events-auto bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 transition-colors flex items-center gap-2"
              >
                <MonitorPlay size={14} /> Exit Theater Mode
              </button>
            )}
          </div>
        </div>

        {/* Modern Controls Bar */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-24 pb-4 px-4 sm:px-6 flex flex-col gap-3 transition-all duration-300 ease-out ${
            showControls && !adActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          {/* Seek Bar */}
          <div className="flex items-center gap-4 w-full group/seek relative">
            <div 
              className="relative flex-1 h-1.5 flex items-center py-2 cursor-pointer"
              onMouseMove={handleSeekMouseMove}
              onMouseLeave={() => setIsHoveringSeek(false)}
            >
              {/* Tooltip Preview */}
              {isHoveringSeek && duration > 0 && (
                <div 
                  className="absolute bottom-full mb-2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50 transition-all duration-100 ease-out"
                  style={{ left: `${hoverPosition * 100}%` }}
                >
                  <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-2 py-1 rounded shadow-2xl">
                    <span className="text-[11px] font-bold font-mono text-white tracking-wide">
                      {formatTime(hoverTime)}
                    </span>
                  </div>
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-white/20" />
                </div>
              )}

              <input
                type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className="absolute w-full h-1 bg-white/20 rounded-full overflow-hidden transition-all duration-200 group-hover/seek:h-1.5">
                <div className="h-full bg-accent-green relative" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
              </div>
            </div>
            <span className="text-[11px] font-bold font-mono text-white/80 select-none w-24 text-right">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-3 sm:gap-5">
              <button onClick={handlePlayPause} className="text-white hover:scale-110 transition-transform cursor-pointer" title={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={24} className="fill-white" /> : <Play size={24} className="fill-white" />}
              </button>
              
              <button onClick={() => handleSkip(-10)} className="text-white/80 hover:text-white transition-colors flex items-center relative" title="Rewind 10s">
                <RotateCcw size={22} />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
              </button>
              <button onClick={() => handleSkip(10)} className="text-white/80 hover:text-white transition-colors flex items-center relative" title="Forward 10s">
                <RotateCw size={22} />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 group/volume ml-2">
                <button onClick={toggleMute} className="text-white hover:scale-110 transition-transform cursor-pointer">
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                  className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Right side controllers */}
            <div className="flex items-center gap-3 sm:gap-4 relative">
              {/* Audio Track Menu */}
              <div className="relative">
                <button 
                  onClick={() => toggleMenu('audio')}
                  className={`hover:text-accent-green transition-colors font-bold text-xs uppercase tracking-wider flex items-center gap-1 ${activeMenu === 'audio' ? 'text-accent-green' : 'text-white'}`}
                >
                  <Mic size={16} />
                  <span className="hidden sm:inline">
                    {getLanguageName(currentLanguage).split(' ')[0]}
                  </span>
                </button>
                {activeMenu === 'audio' && (
                  <div className="absolute bottom-12 right-0 z-50 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-xl p-2 shadow-2xl min-w-[140px] animate-in fade-in slide-in-from-bottom-2">
                    <div className="px-2 py-1.5 border-b border-white/10 mb-1">
                      <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Audio Source</span>
                    </div>
                    {Array.from(new Set(availableStreams.map(s => s.language))).map((lang) => {
                      const stream = availableStreams.find(s => s.language === lang && !failedStreamUrls.has(s.sourceUrl));
                      if (!stream) return null;
                      return (
                        <button key={lang} onClick={() => handleHotSwap(lang, stream.sourceUrl)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between ${currentLanguage === lang ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                          {getLanguageName(lang)}
                          {currentLanguage === lang && <span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_8px_rgba(0,230,118,0.8)]" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quality Settings */}
              {hlsLevels.length > 0 && (
                <div className="relative">
                  <button onClick={() => toggleMenu('quality')} className={`hover:text-white transition-colors cursor-pointer font-bold text-xs ${activeMenu === 'quality' ? 'text-white' : 'text-white/80'}`}>
                    {currentLevelIndex === -1 ? 'Auto' : `${hlsLevels[currentLevelIndex]?.height}p`}
                  </button>
                  {activeMenu === 'quality' && (
                    <div className="absolute bottom-12 right-0 z-50 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-xl p-2 shadow-2xl min-w-[120px] animate-in fade-in slide-in-from-bottom-2">
                      <div className="px-2 py-1.5 border-b border-white/10 mb-1">
                        <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Quality</span>
                      </div>
                      <button onClick={() => { if(hlsRef.current) hlsRef.current.nextLevel = -1; setCurrentLevelIndex(-1); setActiveMenu(null); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${currentLevelIndex === -1 ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}>Auto</button>
                      {[...hlsLevels].reverse().map((level, idx) => {
                        const originalIndex = hlsLevels.length - 1 - idx;
                        return (
                          <button key={originalIndex} onClick={() => { if(hlsRef.current) hlsRef.current.nextLevel = originalIndex; setCurrentLevelIndex(originalIndex); setActiveMenu(null); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${currentLevelIndex === originalIndex ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}>
                            {level.height}p
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Subtitles Menu */}
              <div className="relative">
                <button onClick={() => toggleMenu('subtitles')} className={`hover:text-accent-green transition-colors cursor-pointer ${activeMenu === 'subtitles' || (activeSubtitle && activeSubtitle !== 'none') ? 'text-accent-green' : 'text-white'}`}>
                  <Subtitles size={20} />
                </button>
                {activeMenu === 'subtitles' && (
                  <div className="absolute bottom-12 right-0 z-50 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-xl p-2 shadow-2xl min-w-[200px] max-h-80 flex flex-col animate-in fade-in slide-in-from-bottom-2">
                    <div className="px-2 py-1.5 border-b border-white/10 mb-1">
                      <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Subtitles</span>
                    </div>
                    <div className="overflow-y-auto max-h-48 custom-scrollbar">
                      <button onClick={() => { setActiveSubtitle('none'); setActiveMenu(null); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${activeSubtitle === 'none' ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>Off</button>
                      {subtitles.map((sub, idx) => (
                        <button key={idx} onClick={() => { setActiveSubtitle(sub.lang); setActiveMenu(null); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${activeSubtitle === sub.lang ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Speed / Settings */}
              <div className="relative">
                <button onClick={() => toggleMenu('speed')} className={`hover:scale-110 transition-transform cursor-pointer ${activeMenu === 'speed' ? 'text-accent-green' : 'text-white/90'}`}>
                  <Settings size={20} />
                </button>
                {activeMenu === 'speed' && (
                  <div className="absolute bottom-12 right-0 z-50 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-xl p-2 shadow-2xl min-w-[120px] animate-in fade-in slide-in-from-bottom-2">
                    <div className="px-2 py-1.5 border-b border-white/10 mb-1">
                      <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">Playback Speed</span>
                    </div>
                    {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                      <button key={rate} onClick={() => { if(videoRef.current) videoRef.current.playbackRate = rate; setPlaybackRate(rate); setActiveMenu(null); }} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${playbackRate === rate ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'}`}>
                        {rate === 1 ? 'Normal' : `${rate}x`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Episodes Button Placeholder */}
              <button className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors font-bold text-xs uppercase tracking-wider text-white/90">
                <ListVideo size={18} />
                <span>Episodes</span>
              </button>

              {/* Theater Mode & PiP & Fullscreen */}
              <div className="flex items-center gap-3 sm:gap-4 ml-2 pl-2">
                <button onClick={togglePiP} className={`hover:text-white transition-colors cursor-pointer ${isPiP ? 'text-accent-green' : 'text-white/90'}`} title="Picture in Picture">
                  <PictureInPicture size={18} />
                </button>
                <button onClick={() => setIsTheaterMode(p => !p)} className={`hover:text-white transition-colors cursor-pointer hidden md:block ${isTheaterMode ? 'text-accent-green' : 'text-white/90'}`} title="Theater Mode">
                  <Monitor size={18} />
                </button>
                <button className="text-white/90 hover:text-white transition-colors cursor-pointer hidden sm:block" title="Cast">
                  <Cast size={18} />
                </button>
                <button onClick={toggleFullscreen} className="text-white/90 hover:text-white hover:scale-110 transition-transform cursor-pointer ml-1" title="Fullscreen">
                  {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <DownloadModal 
          isOpen={isDownloadModalOpen}
          onClose={() => setIsDownloadModalOpen(false)}
          streamUrl={streamUrl}
          downloadUrl={downloadUrl}
          hlsLevels={hlsLevels}
          audioTracks={audioTracks}
          subtitles={subtitles}
          availableLangs={backendLangs}
          currentLanguage={currentLanguage}
        />
      </div>
      
      {adActive && (
        <div className="absolute inset-0 z-[60]">
          <GoogleImaAdPlayer 
            onComplete={() => setAdFinished(true)} 
            isStreamReady={playbackReady || (!isLoading && streamUrl !== null)} 
            mediaId={String(malId || tmdbId)}
            mediaType={mediaType}
          />
        </div>
      )}
    </div>
  );
}
