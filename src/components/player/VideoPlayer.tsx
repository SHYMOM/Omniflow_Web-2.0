'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  Settings, Download, RotateCcw, AlertCircle, Info, Subtitles, Mic 
} from 'lucide-react';
import { buildEmbedUrl } from '@/lib/utils/serverBuilder';
import type { Server } from '@/types/server';
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
  serverId: string;
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

export default function VideoPlayer({ malId, tmdbId, mediaType, episode, season, serverId, mediaTitle, imdbId }: VideoPlayerProps) {
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
  const [servers, setServers] = useState<Server[]>([]);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  
  // Custom Player states
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [adActive, setAdActive] = useState(false);
  const [isDirectStream, setIsDirectStream] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
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
  
  const [activeMenu, setActiveMenu] = useState<'speed' | 'quality' | 'audio' | 'subtitles' | null>(null);
  
  // Using currentLanguage from store instead of local state
  
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [loadingText, setLoadingText] = useState('Aggregating stream links...');

  // Hot swap persistence
  const hotSwapTimeRef = useRef<number | null>(null);
  const hotSwapRateRef = useRef<number>(1);
  const hotSwapVolumeRef = useRef<number>(1);
  const loadedKeyRef = useRef<string | null>(null);
  const hotSwapToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNativeSwitchRef = useRef<boolean>(false);

  /**
   * Hot-Swap Audio Engine — seamlessly switch between different external
   * video URLs at the exact same timestamp without the user losing their place.
   *
   * 1. Save exact currentTime, playbackRate, and volume
   * 2. Show a toast notification ("Switching to Hindi...")
   * 3. Destroy current hls instance
   * 4. Set new stream URL (triggers hls re-init via useEffect)
   * 5. On MANIFEST_PARSED, seek to saved currentTime and restore settings
   */
  const handleHotSwap = useCallback((lang: string, url: string) => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // 1. Save playback state
    hotSwapTimeRef.current = video.currentTime;
    hotSwapRateRef.current = video.playbackRate || 1;
    hotSwapVolumeRef.current = video.volume;

    // 2. Show toast
    const langName = getLanguageName(lang);
    setHotSwapToast(`Switching to ${langName}...`);
    if (hotSwapToastTimerRef.current) clearTimeout(hotSwapToastTimerRef.current);
    hotSwapToastTimerRef.current = setTimeout(() => setHotSwapToast(null), 4000);

    // 3. Destroy current hls
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 4. Update state — the streamUrl useEffect will re-initialize hls
    setCurrentLanguage(lang);
    setActiveMenu(null);
    setIsLoading(true);
    setStreamUrl(url);
  }, [setCurrentLanguage, setHotSwapToast]);

  /**
   * Auto-Fallback Engine — if the current stream fatally fails,
   * automatically switch to the next available language stream.
   */
  const attemptAutoFallback = useCallback(() => {
    const state = usePlayerStore.getState();
    const streams = state.availableStreams;
    const failedUrls = state.failedStreamUrls;

    if (streams.length <= 1) return false;

    const currentUrl = streamUrl;
    const fallbackStream = streams.find(
      s => s.sourceUrl !== currentUrl && !failedUrls.has(s.sourceUrl)
    );

    if (fallbackStream) {
      const currentLangName = getLanguageName(state.currentLanguage);
      const fallbackLangName = getLanguageName(fallbackStream.language);
      state.setHotSwapToast(`${currentLangName} stream failed — switching to ${fallbackLangName}...`);

      if (currentUrl) state.addFailedStreamUrl(currentUrl);

      handleHotSwap(fallbackStream.language, fallbackStream.sourceUrl);
      return true;
    }

    return false;
  }, [streamUrl, handleHotSwap]);

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
  // Tracks the language that was last successfully fetched — prevents language-fallback
  // from triggering a re-fetch loop when setCurrentLanguage('sub') is called on failure.
  const lastFetchedLanguageRef = useRef<string>('sub');

  // 1. Fetch server configs for iframe fallback
  useEffect(() => {
    fetch('/servers.json').then(r => r.json()).then(setServers).catch(() => {});
  }, []);

  const [resolvedTmdbId, setResolvedTmdbId] = useState<number | null>(tmdbId);

  // 1b. Fetch real TMDB ID for Anime (since frontend only has MAL/Anilist ID)
  useEffect(() => {
    if (mediaType === 'anime' && malId) {
      fetch(`https://arm.haglund.dev/api/v2/ids?source=myanimelist&id=${malId}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.themoviedb) {
            setResolvedTmdbId(Number(data.themoviedb));
          }
        })
        .catch(console.error);
    } else {
      setResolvedTmdbId(tmdbId);
    }
  }, [mediaType, malId, tmdbId]);

  // 2. Build the standard fallback embed url
  useEffect(() => {
    // Standard logic for Movies/TV/Anime
    const server = servers.find(s => s.id === serverId) || servers[0];
    if (!server) return;
    const type = mediaType === 'anime' ? 'anime_sub' : mediaType === 'movie' ? 'movie' : 'tv';
    const url = buildEmbedUrl(server, { type, malId, tmdbId: resolvedTmdbId || undefined, episode, season });
    setEmbedUrl(url);
  }, [servers, serverId, malId, resolvedTmdbId, mediaType, episode, season]);

  // 3. Resolve Direct HLS Stream via Backend Aggregator
  useEffect(() => {
    if (isNativeSwitchRef.current) {
      isNativeSwitchRef.current = false;
      return;
    }

    let active = true;
    let t1: NodeJS.Timeout;
    let t2: NodeJS.Timeout;
    
    if (serverId !== 'omniflow_direct') {
      setIsDirectStream(false);
      setStreamUrl(null);
      setDownloadUrl(null);
      setSubtitles([]);
      setIsLoading(false);
      setAdActive(false);
      return;
    }

    const id = mediaType === 'anime' 
      ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`)
      : (mediaType === 'movie' ? `tmdb-movie-${tmdbId}` : `tmdb-tv-${tmdbId}`);
    
    const currentKey = `${id}:${episode}:${season}`;

    // Skip network request if we already pre-fetched all available streams and are just hot-swapping
    if (loadedKeyRef.current === currentKey && availableStreams.length > 0) {
      const match = availableStreams.find(s => s.language === currentLanguage);
      if (match) {
        setStreamUrl(match.sourceUrl);
        setIsLoading(false);
        return () => { active = false; };
      }
    }

    setIsLoading(true);
    setAdActive(true);
    setIsDirectStream(true); // Mount direct player container immediately for ad overlay and background buffering
    setPlaybackReady(false); // Reset buffering state
    setStreamUrl(null);
    setDownloadUrl(null);
    setSubtitles([]);
    setHlsLevels([]);
    clearFailedStreamUrls(); // Reset failed streams for new media
    setAudioTracks([]);
    setLoadingText('Initializing scraper...');
    
    const resolveDirectStream = async () => {
      try {
        t1 = setTimeout(() => {
          if (active) setLoadingText('Trying 5 sources...');
        }, 1500);
        t2 = setTimeout(() => {
          if (active) setLoadingText('Extracting HLS streams...');
        }, 4000);

        const dubbedParam = currentLanguage !== 'sub' ? '&dubbed=true' : '';
        const langParam = `&lang=${currentLanguage}`;
        const titleParam = mediaTitle ? `&title=${encodeURIComponent(mediaTitle)}` : '';
        const imdbParam = imdbId ? `&imdbId=${imdbId}` : '';
        const res = await fetch(`/api/stream?type=${mediaType}&id=${id}&episode=${episode}&season=${season}${dubbedParam}${langParam}${titleParam}${imdbParam}`);
        const data = await res.json();
        
        clearTimeout(t1);
        clearTimeout(t2);

        if (active) {
          if (data.success && data.url) {
            setStreamUrl(data.url);
            setDownloadUrl(data.downloadUrl || data.url);
            setSubtitles(data.subtitles || []);
            setIsDirectStream(true);
            loadedKeyRef.current = currentKey;
            lastFetchedLanguageRef.current = currentLanguage;
            
            // Backend provides available languages and streams
            if (data.availableStreams && data.availableStreams.length > 0) {
              setAvailableStreams(data.availableStreams);
            }
            if (data.availableLanguages && data.availableLanguages.length > 0) {
               setBackendLangs(data.availableLanguages);
               setAvailableLanguages(data.availableLanguages);
            }
            
            const defaultSub = data.subtitles?.find((s: any) => s.default);
            if (defaultSub) setActiveSubtitle(defaultSub.lang);
          } else {
            // If the stream failed to resolve AND we explicitly requested a dub,
            // switch back to sub — but only if we haven't already fetched sub for this key.
            if (currentLanguage !== 'sub' && lastFetchedLanguageRef.current !== 'sub') {
              console.warn(`${currentLanguage === 'hin-dub' ? 'Hindi' : 'English'} dub not found! Switching back to original...`);
              lastFetchedLanguageRef.current = 'sub';
              setCurrentLanguage('sub');
              return; // The language state change will trigger a re-fetch
            } else {
              setIsDirectStream(false);
            }
          }
          setIsLoading(false);
        }
      } catch (err) {
        clearTimeout(t1);
        clearTimeout(t2);
        if (active) {
          setIsDirectStream(false);
          setIsLoading(false);
        }
      }
    };

    resolveDirectStream();
    return () => {
      active = false;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [mediaType, malId, tmdbId, episode, season, serverId, currentLanguage, mediaTitle]);

  // Merge external subtitles into unified subtitles menu
  useEffect(() => {
    if (externalSubtitles && externalSubtitles.length > 0) {
      setSubtitles(prev => {
        const merged = [...prev];
        externalSubtitles.forEach(ext => {
          if (!merged.find(s => s.url === ext.url)) {
            merged.push({ label: ext.lang, lang: ext.lang, url: ext.url, default: false });
          }
        });
        return merged;
      });
    }
  }, [externalSubtitles]);

  // 4. Initialize Hls.js dynamically for .m3u8 streaming
  useEffect(() => {
    if (!isDirectStream || !streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = streamUrl.includes('format=m3u8') || (streamUrl.includes('.m3u8') && !streamUrl.includes('format=mp4'));
    
    const tryPlay = () => {
      // Stream is ready to be played (manifest parsed or source set)
      setPlaybackReady(true);
      
      // If ad is currently active, don't auto-play yet, let the post-ad useEffect handle it once buffered
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

        // Reset retry counter for fresh initialization
        hlsRetryCountRef.current = 0;

        const hls = new Hls({
          maxMaxBufferLength: 30,
          enableWorker: true,
          // Generous retry settings for flaky pirate CDNs
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
          // Hot-swap restoration: seek to saved timestamp and restore playback settings
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
          // Dismiss toast on successful playback
          setHotSwapToast(null);
          tryPlay();
          
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
            console.warn(`[HLS] Fatal error type=${data.type} details=${data.details} retry=${hlsRetryCountRef.current}/${HLS_MAX_RETRIES}`);
            
            // INSTANT FALLBACK for Proxy/Cloudflare blocks (403, 500)
            const statusCode = data.response?.code;
            if (statusCode === 403 || statusCode === 500 || data.details === 'manifestLoadError') {
                console.error(`[HLS] Instant fallback triggered due to ${statusCode || data.details}`);
                if (!attemptAutoFallback()) {
                  setIsDirectStream(false);
                }
                return;
            }
            
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (hlsRetryCountRef.current < HLS_MAX_RETRIES) {
                  hlsRetryCountRef.current++;
                  console.log(`[HLS] Network error, retrying (${hlsRetryCountRef.current}/${HLS_MAX_RETRIES})...`);
                  if (data.details === 'manifestLoadError') {
                    hls.loadSource(streamUrl);
                  } else {
                    hls.startLoad();
                  }
                } else {
                  console.error('[HLS] Network error retries exhausted.');
                  // AUTO-FALLBACK: Try the next available stream
                  if (!attemptAutoFallback()) {
                    console.error('[HLS] No fallback streams available, falling back to embed.');
                    setIsDirectStream(false);
                  }
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                if (hlsRetryCountRef.current < HLS_MAX_RETRIES) {
                  hlsRetryCountRef.current++;
                  console.log(`[HLS] Media error, recovering (${hlsRetryCountRef.current}/${HLS_MAX_RETRIES})...`);
                  hls.recoverMediaError();
                } else {
                  console.error('[HLS] Media error retries exhausted.');
                  // AUTO-FALLBACK: Try the next available stream
                  if (!attemptAutoFallback()) {
                    console.error('[HLS] No fallback streams available, falling back to embed.');
                    setIsDirectStream(false);
                  }
                }
                break;
              default:
                console.error('[HLS] Unrecoverable error.');
                if (!attemptAutoFallback()) {
                  setIsDirectStream(false);
                }
                break;
            }
          }
        });

        // Reset retry counter on successful fragment load (stream is working)
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
  }, [isDirectStream, streamUrl, setAvailableLanguages]);
 
  // 4b. Auto-play stream once ad finishes and stream has finished buffering
  useEffect(() => {
    if (!adActive && isDirectStream && streamUrl && videoRef.current && playbackReady) {
      const video = videoRef.current;
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [adActive, isDirectStream, streamUrl, playbackReady]);

  // 5. Controls Logic
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, []);

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

  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
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

  useEffect(() => {
    const handleFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFs);
    return () => document.removeEventListener('fullscreenchange', handleFs);
  }, []);

  // 5b. Keyboard Shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only capture shortcuts when playing direct stream and ad is not active
      if (!isDirectStream || adActive || !videoRef.current) return;

      // Ignore shortcuts if the user is typing in form inputs or editable text areas
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const video = videoRef.current;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
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
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirectStream, adActive, handlePlayPause, toggleMute, toggleFullscreen]);

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
  const handleAudioTrackSelect = (index: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.audioTrack = index;
    const trackId = hlsRef.current.audioTracks[index]?.id ?? index;
    setCurrentAudioTrackId(trackId);

    const track = hlsRef.current.audioTracks[index];
    if (track) {
      const trackLang = track.language || track.name || '';
      const normLang = trackLang.toLowerCase();
      let newLang = 'sub';
      if (normLang.includes('hin') || normLang.includes('hindi')) newLang = 'hin-dub';
      else if (normLang.includes('eng') || normLang.includes('english')) newLang = 'eng-dub';
      
      isNativeSwitchRef.current = true;
      setCurrentLanguage(newLang);
    }

    setActiveMenu(null);
  };

  const handleSubtitleSelect = (lang: string) => {
    setActiveSubtitle(lang);
    setActiveMenu(null);
  };

  // Enforce subtitle track modes when activeSubtitle or subtitles array changes
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Give the browser a tick to parse the <track> elements
    const timer = setTimeout(() => {
      if (!videoRef.current) return;
      
      const tracks = videoRef.current.textTracks;
      
      if (activeSubtitle.startsWith('hls-')) {
        // Disable external tracks
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
        if (hlsRef.current) {
          hlsRef.current.subtitleTrack = parseInt(activeSubtitle.replace('hls-', ''), 10);
        }
      } else if (activeSubtitle === 'none') {
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = 'disabled';
        }
        if (hlsRef.current) {
          hlsRef.current.subtitleTrack = -1;
        }
      } else {
        // Enable the specific external track
        if (hlsRef.current) {
          hlsRef.current.subtitleTrack = -1;
        }
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = tracks[i].language === activeSubtitle ? 'showing' : 'disabled';
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeSubtitle, subtitles, streamUrl]);

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

  const getTrackDisplayName = (track: any, index: number) => {
    if (!track) return 'Audio';
    if (track.language && track.language !== 'und' && track.language !== 'unknown') {
      const name = getLanguageName(track.language);
      if (name !== 'Original Language') return name;
    }
    if (track.name && track.name.toLowerCase() !== 'original language' && track.name !== 'und') {
      return track.name;
    }
    return `Track ${index + 1}`;
  };

  const handleSubtitleDelayChange = (delta: number) => {
    const newDelay = subtitleDelay + delta;
    setSubtitleDelay(newDelay);
    
    if (videoRef.current) {
      const tracks = videoRef.current.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].mode === 'showing') {
          const cues = tracks[i].cues;
          if (cues) {
            for (let j = 0; j < cues.length; j++) {
              const cue = cues[j] as any;
              cue.startTime += delta;
              cue.endTime += delta;
            }
          }
        }
      }
    }
  };

  // ─── RENDER PLAYER CONTENT ──────────────────────────────
  const renderPlayerContent = () => {
    if (!isDirectStream) {
      if (isLoading) {
        return (
          <div className="relative w-full h-full bg-void flex flex-col items-center justify-center">
            <LoadingSpinner size={48} />
            <p className="text-xs text-text-muted mt-4 font-medium uppercase tracking-widest animate-pulse">{loadingText}</p>
          </div>
        );
      }
      return (
        <div className="relative w-full h-full">
          {embedUrl ? (
            <iframe 
              src={embedUrl} 
              allowFullScreen 
              className="w-full h-full border-0" 
              title="Video Player" 
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-void text-center"><AlertCircle size={32} className="text-text-muted" /></div>
          )}
        </div>
      );
    }

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
            onCanPlayThrough={() => { setPlaybackReady(true); setIsBuffering(false); }}
            onError={(e) => {
              const video = videoRef.current;
              // Ignore empty source/mount errors
              if (!video || !video.src || video.src === window.location.href) {
                return;
              }
              // When hls.js is active, it handles errors internally via its own
              // error event. The <video> element may fire spurious errors during
              // normal HLS recovery (e.g. segment retries, media error recovery).
              // Only kill the player if hls.js is NOT managing playback.
              if (hlsRef.current) {
                console.warn('[VideoPlayer] Suppressed <video> onError while hls.js is active');
                return;
              }
              console.error('Video playback failed', e);
              setIsDirectStream(false);
            }}
            className="w-full h-full object-contain"
            crossOrigin="anonymous"
            playsInline
          >
            {subtitles.filter(sub => sub.url && !sub.lang.startsWith('hls-')).map((sub, i) => (
              <track key={i} label={sub.label} src={sub.url} srcLang={sub.lang} kind="subtitles" default={sub.lang === activeSubtitle} />
            ))}
          </video>
 
          {/* Loading Indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm z-30">
              <LoadingSpinner size={48} />
              <span className="text-xs text-white mt-4 font-bold uppercase tracking-widest animate-pulse">
                {loadingText}
              </span>
              <span className="text-[10px] text-text-muted mt-2 font-mono uppercase tracking-widest">
                Searching multiple premium sources
              </span>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !adActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-10 pointer-events-none">
              <LoadingSpinner size={48} />
              <span className="text-xs text-text-muted mt-4 font-semibold uppercase tracking-widest animate-pulse">
                Buffering stream...
              </span>
            </div>
          )}
          {!isPlaying && !isLoading && !adActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity pointer-events-none z-10">
              <div className="w-20 h-20 rounded-full bg-accent-green/20 backdrop-blur-md border border-accent-green/50 flex items-center justify-center text-accent-green scale-100 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(0,230,118,0.3)]">
                <Play size={36} className="fill-accent-green ml-2" />
              </div>
            </div>
          )}

          {/* Hot-Swap Language Toast */}
          {hotSwapToast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-xl border border-accent-green/30 rounded-full shadow-[0_0_20px_rgba(0,230,118,0.15)]">
                <RotateCcw size={14} className="text-accent-green animate-spin" />
                <span className="text-xs font-bold text-white tracking-wide">{hotSwapToast}</span>
              </div>
            </div>
          )}

          {/* Premium Glassmorphic Controls Bar */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pt-24 pb-4 px-4 flex flex-col gap-3 transition-all duration-300 ease-out ${
              showControls && !adActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {/* Top Progress Seek Bar */}
            <div className="flex items-center gap-3 w-full group/seek relative">
              <span className="text-[11px] font-medium font-mono text-white/80">{formatTime(currentTime)}</span>
              
              <div 
                className="relative flex-1 h-1.5 flex items-center"
                onMouseMove={handleSeekMouseMove}
                onMouseLeave={() => setIsHoveringSeek(false)}
              >
                {/* Tooltip Preview */}
                {isHoveringSeek && duration > 0 && (
                  <div 
                    className="absolute bottom-full mb-3 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50"
                    style={{ left: `${hoverPosition * 100}%` }}
                  >
                    {/* We omit the heavy canvas frame grabber for performance, but show a sleek time indicator */}
                    <div className="bg-void/90 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-md shadow-xl">
                      <span className="text-[11px] font-bold font-mono text-white tracking-wide">
                        {formatTime(hoverTime)}
                      </span>
                    </div>
                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white/20" />
                  </div>
                )}

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

                <div className="hidden sm:flex items-center gap-2 group/volume">
                  <button onClick={toggleMute} className="text-white hover:text-accent-green transition-colors cursor-pointer">
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  <input
                    type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                    className="w-0 opacity-0 group-hover/volume:w-20 group-hover/volume:opacity-100 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white transition-all outline-none"
                  />
                </div>

                <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-accent-green/10 border border-accent-green/20 rounded text-[9px] font-bold uppercase text-accent-green tracking-wider shadow-[0_0_10px_rgba(0,230,118,0.1)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" /> Direct
                </span>
              </div>

              {/* Right side controllers */}
              <div className="flex items-center gap-2 sm:gap-4 relative">
                
                {/* Audio Language Switcher */}
                <div className="relative">
                  <button 
                    onClick={() => (audioTracks.length > 1 || availableStreams.length > 1 || backendLangs.length > 1) && toggleMenu('audio')}
                    disabled={audioTracks.length <= 1 && availableStreams.length <= 1 && backendLangs.length <= 1}
                    className={`hover:text-accent-green transition-colors p-1 font-bold text-xs uppercase tracking-wider ${activeMenu === 'audio' ? 'text-accent-green' : 'text-white'} ${(audioTracks.length <= 1 && availableStreams.length <= 1 && backendLangs.length <= 1) ? 'opacity-50 cursor-not-allowed hidden sm:inline-block' : 'cursor-pointer inline-block'}`}
                    title="Audio Language"
                  >
                    <Mic size={14} className="inline mr-1 mb-0.5" />
                    <span className="hidden sm:inline">
                      {audioTracks.length > 1 && currentAudioTrackId > -1 
                        ? getTrackDisplayName(audioTracks.find(t => t.id === currentAudioTrackId), currentAudioTrackId).split(' ')[0]
                        : (availableStreams.length > 1 || backendLangs.length > 1 ? getLanguageName(currentLanguage).split(' ')[0] : 'Audio')}
                    </span>
                  </button>
                  {activeMenu === 'audio' && (audioTracks.length > 1 || availableStreams.length > 1 || backendLangs.length > 1) && (
                    <div className="absolute bottom-10 sm:bottom-12 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[120px]">
                      {audioTracks.length > 1 ? (
                        audioTracks.map((track, index) => (
                          <button key={track.id || index} onClick={() => handleAudioTrackSelect(index)} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${currentAudioTrackId === track.id ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                            {getTrackDisplayName(track, index)}
                          </button>
                        ))
                      ) : availableStreams.length > 1 ? (
                        Array.from(new Set(availableStreams.map(s => s.language))).map((lang) => {
                          const stream = availableStreams.find(s => s.language === lang);
                          if (!stream) return null;
                          return (
                            <button key={lang} onClick={() => handleHotSwap(lang, stream.sourceUrl)} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${currentLanguage === lang ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                              {getLanguageName(lang)}
                            </button>
                          );
                        })
                      ) : (
                        Array.from(new Set(backendLangs)).map((langOpt) => (
                          <button key={langOpt} onClick={() => { setCurrentLanguage(langOpt); setActiveMenu(null); }} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${currentLanguage === langOpt ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                            {getLanguageName(langOpt)}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Subtitles Menu */}
                <div className="relative">
                  <button 
                    onClick={() => toggleMenu('subtitles')}
                    className={`hover:text-accent-green transition-colors p-1.5 cursor-pointer inline-block ${activeMenu === 'subtitles' || (activeSubtitle && activeSubtitle !== 'none') ? 'text-accent-green' : 'text-white'}`} 
                    title="Subtitles"
                  >
                    <Subtitles size={20} />
                  </button>
                  {activeMenu === 'subtitles' && (
                    <div className="absolute bottom-12 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[180px] max-h-80 flex flex-col">
                      {/* Subtitle Delay Controls */}
                      {activeSubtitle !== 'none' && (
                        <div className="flex items-center justify-between px-2 py-2 mb-1 border-b border-white/10">
                          <span className="text-[10px] text-white/70 font-bold uppercase tracking-wider">Delay</span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleSubtitleDelayChange(-0.5); }} className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-white hover:bg-white/20 text-xs">-</button>
                            <span className="text-[10px] font-mono w-8 text-center text-accent-green">{subtitleDelay > 0 ? '+' : ''}{subtitleDelay}s</span>
                            <button onClick={(e) => { e.stopPropagation(); handleSubtitleDelayChange(0.5); }} className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-white hover:bg-white/20 text-xs">+</button>
                          </div>
                        </div>
                      )}
                      
                      <div className="overflow-y-auto max-h-48">
                        <button onClick={() => handleSubtitleSelect('none')} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${activeSubtitle === 'none' ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>Off</button>
                        {subtitles.map((sub, idx) => (
                          <div key={idx} className={`w-full flex items-center justify-between rounded transition-colors ${activeSubtitle === sub.lang ? 'bg-accent-green/10' : 'hover:bg-white/10'}`}>
                            <button onClick={() => handleSubtitleSelect(sub.lang)} className={`flex-1 text-left px-3 py-2 text-xs font-bold ${activeSubtitle === sub.lang ? 'text-accent-green' : 'text-white'}`}>
                              {sub.label}
                            </button>
                            {sub.url && !sub.lang.startsWith('hls-') && (
                              <a 
                                href={sub.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                download 
                                className="px-3 py-2 text-white/50 hover:text-accent-green transition-colors" 
                                title="Download Subtitle" 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download size={14} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 pt-1 border-t border-white/10">
                        <label className="w-full cursor-pointer text-left px-3 py-1.5 rounded text-[11px] font-bold text-accent-green hover:bg-white/10 flex items-center transition-colors">
                           + Custom Subtitle
                           <input type="file" accept=".vtt,.srt" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = URL.createObjectURL(file);
                              const customSub = {
                                label: file.name,
                                lang: 'custom-' + Date.now(),
                                url: url,
                                default: true
                              };
                              setSubtitles(prev => [...prev, customSub]);
                              handleSubtitleSelect(customSub.lang);
                           }} />
                        </label>
                      </div>
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
                      <div className="absolute bottom-10 sm:bottom-12 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[100px]">
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
                    <div className="absolute bottom-10 sm:bottom-12 right-0 z-50 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg p-1.5 shadow-2xl min-w-[100px]">
                      {[0.5, 1, 1.25, 1.5, 2, 2.5, 3].map((rate) => (
                        <button key={rate} onClick={() => { if(videoRef.current) videoRef.current.playbackRate = rate; setPlaybackRate(rate); setActiveMenu(null); }} className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-colors ${playbackRate === rate ? 'bg-accent-green/10 text-accent-green' : 'text-white hover:bg-white/10'}`}>
                          {rate === 1 ? 'Normal' : `${rate}x`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Download Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDownloadModalOpen(true);
                  }}
                  className="hover:text-accent-green transition-colors cursor-pointer p-1.5 text-white" 
                  title="Download Stream"
                >
                  <Download size={20} />
                </button>

                <button onClick={toggleFullscreen} className="text-white hover:text-accent-green transition-colors cursor-pointer p-1.5 ml-2" title="Fullscreen">
                  {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
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
      </div>
    );
  };

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border">
      {renderPlayerContent()}
      
      {adActive && (
        <div className="absolute inset-0 z-50">
          <GoogleImaAdPlayer 
            onComplete={() => setAdActive(false)} 
            isStreamReady={isDirectStream ? playbackReady : true} 
            mediaId={String(malId || tmdbId)}
            mediaType={mediaType}
          />
        </div>
      )}
    </div>
  );
}
