'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, 
  Settings, Download, RotateCcw, RotateCw, AlertCircle, Info, Subtitles, Mic,
  ListVideo, PictureInPicture, Monitor, MonitorPlay, Cast, SkipForward,
  ChevronRight, X, Search, Upload, Sliders, Globe, Server, ArrowLeft
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { usePlayerStore } from '@/store/playerStore';
import { useUserStore } from '@/store/userStore';
import { fetchMediaEpisodesAction } from '@/lib/actions/episodes';
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
  const router = useRouter();
  const { 
    sources, activeSourceIndex, switchSource,
    subtitles: storeSubtitles, setSubtitles: setStoreSubtitles,
    activeSubtitleLang, setActiveSubtitle: setStoreActiveSubtitle,
    showDownloadModal, setShowDownloadModal,
    activeServerId, setActiveServer, setDownloadUrl, setAvailableLanguages,
    availableStreams, setAvailableStreams,
    externalSubtitles, setExternalSubtitles,
    currentLanguage, setCurrentLanguage, downloadUrl,
    isDownloadModalOpen, setIsDownloadModalOpen,
    hotSwapToast, setHotSwapToast,
    failedStreamUrls, addFailedStreamUrl, clearFailedStreamUrls
  } = usePlayerStore();
  
  const { subtitleSettings, settings, history, updateSettings, updateSubtitleSettings } = useUserStore();
  
  // Custom Player states
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [adActive, setAdActive] = useState(false);
  const [adFinished, setAdFinished] = useState(false);
  const [playbackReady, setPlaybackReady] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
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
  
  // Drawer states
  const [activeDrawer, setActiveDrawer] = useState<'episodes' | 'settings' | 'sub-appearance' | 'sub-opensubtitles' | null>(null);
  const [settingsTab, setSettingsTab] = useState<'quality' | 'subtitles' | 'audio' | 'servers' | 'speed'>('subtitles');
  
  // Episode metadata states
  const [episodesList, setEpisodesList] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState<boolean>(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(season);
  const [seasonsList, setSeasonsList] = useState<any[]>([]);
  const [epSearchQuery, setEpSearchQuery] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeMenu, setActiveMenu] = useState<'speed' | 'quality' | 'audio' | 'subtitles' | null>(null);
  const [subtitleDelay, setSubtitleDelay] = useState(0);
  const [loadingText, setLoadingText] = useState('Resolving premium streams...');

  // Skip Intro/Outro (AniSkip) state
  const [skipTimes, setSkipTimes] = useState<{ introStart: number; introEnd: number; outroStart?: number; outroEnd?: number } | null>(null);
  const [skipBtnVisible, setSkipBtnVisible] = useState<'intro' | 'outro' | null>(null);
  const [skipBtnAlwaysVisible, setSkipBtnAlwaysVisible] = useState(false);
  const skipIntroEnteredAt = useRef<number | null>(null);

  // Next Episode countdown state
  const [showNextEpOverlay, setShowNextEpOverlay] = useState(false);
  const [nextEpCountdown, setNextEpCountdown] = useState(5);
  const nextEpCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const nextEpCancelledRef = useRef(false);

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

  // Fetch AniSkip times when malId + episode change
  useEffect(() => {
    if (!malId || mediaType !== 'anime') {
      setSkipTimes(null);
      return;
    }
    setSkipTimes(null);
    import('@/lib/extraction/aniskip.service').then(({ AniSkipService }) => {
      AniSkipService.fetchSkipTimes(malId, episode).then(data => {
        if (data) setSkipTimes(data);
      }).catch(console.warn);
    });
  }, [malId, episode, mediaType]);

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

    setActiveMenu(null);
    setIsLoading(true);
    setStreamUrl(url);
  }, []);

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

  // Fetch TMDB details for logo and seasons list
  useEffect(() => {
    let active = true;
    const fetchShowMeta = async () => {
      try {
        const tmdbIdToQuery = resolvedTmdbId || tmdbId;
        if (!tmdbIdToQuery) return;
        
        const isTV = mediaType === 'tv' || mediaType === 'anime';
        const res = await fetch(`/api/tmdb/${isTV ? 'tv' : 'movie'}/${tmdbIdToQuery}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (!active) return;
        
        // Get logo
        if (data.images?.logos?.length > 0) {
          const englishLogo = data.images.logos.find((l: any) => l.iso_639_1 === 'en');
          const logo = englishLogo || data.images.logos[0];
          setLogoUrl(`https://image.tmdb.org/t/p/w500${logo.file_path}`);
        } else {
          setLogoUrl(null);
        }
        
        // Get seasons list for TV
        if (isTV && data.seasons) {
          setSeasonsList(data.seasons.filter((s: any) => s.season_number > 0));
        } else {
          setSeasonsList([]);
        }
      } catch (e) {
        console.error('Error fetching TMDB show details:', e);
      }
    };
    
    fetchShowMeta();
    return () => { active = false; };
  }, [resolvedTmdbId, tmdbId, mediaType]);

  // Fetch episodes list for the selected season
  useEffect(() => {
    let active = true;
    const loadEpisodes = async () => {
      setEpisodesLoading(true);
      try {
        const id = mediaType === 'anime' 
          ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`)
          : (mediaType === 'movie' ? `tmdb-movie-${tmdbId}` : `tmdb-tv-${tmdbId}`);
        
        const eps = await fetchMediaEpisodesAction(id, mediaType, selectedSeason);
        if (active) {
          setEpisodesList(eps);
        }
      } catch (e) {
        console.error('Failed to load episodes:', e);
      } finally {
        if (active) setEpisodesLoading(false);
      }
    };
    
    loadEpisodes();
    return () => { active = false; };
  }, [malId, tmdbId, mediaType, selectedSeason]);

  // Sync selectedSeason with season prop
  useEffect(() => {
    setSelectedSeason(season);
  }, [season]);

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
    setIframeUrl(null);
    setDownloadUrl(null);
    setSubtitles([]);
    setHlsLevels([]);
    clearFailedStreamUrls();
    setAudioTracks([]);
    setHasFatalError(false);
    
    const resolveDirectStream = async () => {
      // Mock stream support for testing/development
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mock') === 'true') {
        if (active) {
          const mockUrl = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
          setStreamUrl(mockUrl);
          setDownloadUrl(mockUrl);
          setSubtitles([
            { label: 'English', lang: 'eng', url: 'https://raw.githubusercontent.com/andreyvit/subtitle-tools/master/sample.vtt', default: true },
            { label: 'Spanish', lang: 'spa', url: '', default: false }
          ]);
          loadedKeyRef.current = currentKey;
          setAvailableStreams([
            { language: 'sub', sourceUrl: mockUrl, type: 'm3u8' },
            { language: 'eng', sourceUrl: mockUrl + "?lang=eng", type: 'm3u8' },
            { language: 'hin', sourceUrl: mockUrl + "?lang=hin", type: 'm3u8' }
          ]);
          setBackendLangs(['sub', 'eng', 'hin']);
          setAvailableLanguages(['sub', 'eng', 'hin']);
          setIsLoading(false);
        }
        return;
      }
      try {
        const dubbedParam = currentLanguage !== 'sub' ? '&dubbed=true' : '';
        const langParam = `&lang=${currentLanguage}`;
        const titleParam = mediaTitle ? `&title=${encodeURIComponent(mediaTitle)}` : '';
        const imdbParam = imdbId ? `&imdbId=${imdbId}` : '';
        
        const response = await fetch(`/api/stream?type=${mediaType}&id=${id}&episode=${episode}&season=${season}${dubbedParam}${langParam}${titleParam}${imdbParam}`);
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!active) {
            reader.cancel();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const lines = part.split('\n');
            let event = '';
            let data: any = null;

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                event = line.replace('event: ', '').trim();
              } else if (line.startsWith('data: ')) {
                try {
                  data = JSON.parse(line.replace('data: ', '').trim());
                } catch (e) {
                  // ignore
                }
              }
            }

            if (event && data) {
              if (event === 'init') {
                setLoadingText(typeof data === 'string' ? data : 'Resolving premium streams...');
              } else if (event === 'provider_success') {
                setLoadingText(`Found streams from ${data.provider || 'provider'}...`);
              } else if (event === 'done') {
                if (active) {
                  if (data.success && data.source === 'iframe' && data.iframeUrl) {
                    setIframeUrl(data.iframeUrl);
                    setStreamUrl(null);
                    setIsLoading(false);
                    setAdActive(false);
                    return;
                  } else if (data.success && data.url) {
                    setStreamUrl(data.url);
                    setIframeUrl(null);
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
                    setIsLoading(false);
                    return;
                  } else {
                    if (currentLanguage !== 'sub') {
                      console.warn(`Dub not found! Switching back to sub...`);
                      setCurrentLanguage('sub');
                      setAdActive(false);
                      return;
                    } else {
                      setHasFatalError(true);
                      setAdActive(false);
                    }
                    setIsLoading(false);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        if (active) {
          setHasFatalError(true);
          setIsLoading(false);
          setAdActive(false);
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

  // Apply subtitle delay offset to active text track cues dynamically (p-stream-inspired)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const activeTrack = Array.from(video.textTracks).find(t => t.mode === 'showing');
    if (!activeTrack) return;

    const delaySec = subtitleDelay;

    const applyDelay = () => {
      const cues = activeTrack.cues;
      if (!cues) return;
      for (let i = 0; i < cues.length; i++) {
        const cue = cues[i] as any;
        if (cue.originalStartTime === undefined) {
          cue.originalStartTime = cue.startTime;
          cue.originalEndTime = cue.endTime;
        }
        cue.startTime = cue.originalStartTime + delaySec;
        cue.endTime = cue.originalEndTime + delaySec;
      }
    };

    if (activeTrack.cues && activeTrack.cues.length > 0) {
      applyDelay();
    } else {
      const handleCueChange = () => {
        applyDelay();
        activeTrack.removeEventListener('cuechange', handleCueChange);
      };
      activeTrack.addEventListener('cuechange', handleCueChange);
    }
  }, [subtitleDelay, activeSubtitle, streamUrl]);

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
      if (isPlaying && !activeDrawer) {
        setShowControls(false);
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

  // Helper functions for metadata and navigation
  const getBackUrl = () => {
    if (mediaType === 'anime') {
      return malId ? `/anime/mal-${malId}` : `/anime/anilist-${tmdbId}`;
    }
    return `/${mediaType}/${tmdbId}`;
  };

  const formatEpisodeDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0m';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getEpisodeProgress = (epNum: number) => {
    const historyEntry = history.find(h => 
      h.mediaId === (mediaType === 'anime' ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`) : `tmdb-${mediaType}-${tmdbId}`) 
      && h.episodeNumber === epNum
    );
    if (historyEntry) {
      const totalMin = historyEntry.duration || 45;
      const watchedMin = historyEntry.progress * totalMin;
      const leftMin = Math.round(totalMin - watchedMin);
      return leftMin > 0 ? `${leftMin}m left` : 'Completed';
    }
    return null;
  };

  const getEpisodeDurationText = (ep: any) => {
    const progress = getEpisodeProgress(ep.number);
    if (progress) return progress;
    const defaultMin = mediaType === 'movie' ? Math.round(duration / 60) : (mediaType === 'anime' ? 24 : 45);
    return `${defaultMin}m`;
  };

  const playNextEpisode = () => {
    if (episode < episodesList.length) {
      router.push(`/watch?id=${mediaType === 'anime' ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`) : tmdbId}&type=${mediaType}&ep=${episode + 1}&season=${season}`);
    } else {
      const hasNextSeason = seasonsList.some(s => s.season_number === season + 1);
      if (hasNextSeason) {
        router.push(`/watch?id=${mediaType === 'anime' ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`) : tmdbId}&type=${mediaType}&ep=1&season=${season + 1}`);
      }
    }
  };

  const handleEnded = () => {
    setShowNextEpOverlay(false);
    if (settings.autoPlayNext) {
      playNextEpisode();
    }
  };

  // Derived: should show next-ep overlay (last 30s, movie excluded, has next ep)
  const hasNextEpisode = episodesList.length > 0 && (episode < episodesList.length || seasonsList.some(s => s.season_number === season + 1));
  const isNearEnd = duration > 60 && currentTime > 0 && (duration - currentTime) <= 30 && isPlaying;

  // Next episode countdown manager
  useEffect(() => {
    if (!isNearEnd || !hasNextEpisode || mediaType === 'movie' || !settings.autoPlayNext) {
      if (nextEpCountdownRef.current) clearInterval(nextEpCountdownRef.current);
      setShowNextEpOverlay(false);
      setNextEpCountdown(5);
      nextEpCancelledRef.current = false;
      return;
    }

    if (!showNextEpOverlay && !nextEpCancelledRef.current) {
      setShowNextEpOverlay(true);
      setNextEpCountdown(5);
      nextEpCancelledRef.current = false;

      if (nextEpCountdownRef.current) clearInterval(nextEpCountdownRef.current);
      nextEpCountdownRef.current = setInterval(() => {
        setNextEpCountdown(prev => {
          if (prev <= 1) {
            clearInterval(nextEpCountdownRef.current!);
            if (!nextEpCancelledRef.current) playNextEpisode();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (nextEpCountdownRef.current) clearInterval(nextEpCountdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNearEnd, hasNextEpisode, mediaType, settings.autoPlayNext]);

  // Skip segment detection tied to currentTime
  useEffect(() => {
    if (!skipTimes || !isPlaying) {
      setSkipBtnVisible(null);
      return;
    }
    const t = currentTime;
    if (t >= skipTimes.introStart && t <= skipTimes.introEnd) {
      if (skipIntroEnteredAt.current === null) skipIntroEnteredAt.current = t;
      const timeInSeg = t - skipIntroEnteredAt.current;
      setSkipBtnVisible('intro');
      setSkipBtnAlwaysVisible(timeInSeg <= 10);
    } else if (skipTimes.outroStart !== undefined && skipTimes.outroEnd !== undefined && t >= skipTimes.outroStart && t <= skipTimes.outroEnd) {
      if (skipIntroEnteredAt.current === null) skipIntroEnteredAt.current = t;
      const timeInSeg = t - skipIntroEnteredAt.current;
      setSkipBtnVisible('outro');
      setSkipBtnAlwaysVisible(timeInSeg <= 10);
    } else {
      skipIntroEnteredAt.current = null;
      setSkipBtnVisible(null);
      setSkipBtnAlwaysVisible(false);
    }
  }, [currentTime, skipTimes, isPlaying]);

  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      let vttText = text;
      
      if (file.name.endsWith('.srt')) {
        vttText = 'WEBVTT\n\n' + text
          .replace(/\r\n/g, '\n')
          .replace(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/g, '$1:$2:$3.$4');
      }

      const blob = new Blob([vttText], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      const label = file.name.replace(/\.[^/.]+$/, "");
      
      const newSub = {
        label: `${label} (Uploaded)`,
        lang: `uploaded-${Date.now()}`,
        url: blobUrl,
      };

      setSubtitles(prev => getUniqueSubtitles([...prev, newSub]));
      setActiveSubtitle(newSub.lang);
      setHotSwapToast(`Loaded custom subtitles: ${label}`);
      setTimeout(() => setHotSwapToast(null), 3000);
    };
    reader.readAsText(file);
  };

  // Episode Sidebar / Drawer Rendering
  const renderEpisodesDrawer = () => {
    const filtered = episodesList.filter(ep => {
      if (!epSearchQuery.trim()) return true;
      const q = epSearchQuery.toLowerCase();
      return ep.title.toLowerCase().includes(q) || `episode ${ep.number}`.includes(q);
    });

    return (
      <div className="flex flex-col h-full text-white">
        {/* Header / Options bar */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3 bg-zinc-950/80">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={epSearchQuery}
              onChange={(e) => setEpSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full bg-zinc-900 border border-white/10 rounded-full pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
            />
          </div>

          {seasonsList.length > 0 && (
            <div className="relative">
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                className="appearance-none bg-zinc-900 border border-white/10 rounded-full px-4 py-1.5 pr-8 text-xs text-white focus:outline-none focus:border-red-600 cursor-pointer"
              >
                {seasonsList.map((s: any) => (
                  <option key={s.season_number} value={s.season_number}>
                    S{s.season_number}
                  </option>
                ))}
              </select>
              <ChevronRight size={12} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none text-zinc-400" />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Auto next</span>
            <button
              onClick={() => updateSettings({ autoPlayNext: !settings.autoPlayNext })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${settings.autoPlayNext ? 'bg-red-600' : 'bg-zinc-800'}`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.autoPlayNext ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          <button
            onClick={() => setActiveDrawer(null)}
            className="hover:bg-white/10 p-1.5 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
          {episodesLoading ? (
            <div className="flex justify-center items-center py-20">
              <LoadingSpinner size={24} />
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((ep) => {
              const isCurrent = ep.number === episode && selectedSeason === season;
              return (
                <Link
                  key={ep.number}
                  href={`/watch?id=${mediaType === 'anime' ? (malId ? `mal-${malId}` : `anilist-${tmdbId}`) : tmdbId}&type=${mediaType}&ep=${ep.number}&season=${selectedSeason}`}
                  className={`relative block rounded-xl overflow-hidden aspect-[16/9] w-full border-2 transition-all duration-300 group ${isCurrent ? 'border-red-600 bg-zinc-950' : 'border-white/5 hover:border-red-600/50 bg-zinc-900/30'}`}
                >
                  {ep.thumbnail ? (
                    <img
                      src={ep.thumbnail}
                      alt={ep.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      No Preview
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                  {isCurrent && (
                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg text-black animate-scale-in">
                      <Play size={14} className="fill-black ml-0.5" />
                    </div>
                  )}

                  <div className="absolute bottom-0 inset-x-0 p-3.5 flex flex-col justify-end text-left select-none">
                    <h4 className="text-xs font-bold text-white line-clamp-1 leading-tight group-hover:text-red-500 transition-colors">
                      {ep.number}. {ep.title}
                    </h4>
                    <span className="text-[10px] font-bold text-zinc-300 mt-0.5">
                      {getEpisodeDurationText(ep)}
                    </span>
                    {ep.overview && (
                      <p className="text-[9px] text-zinc-400 line-clamp-2 leading-normal mt-1 max-w-[95%]">
                        {ep.overview}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="text-center text-zinc-500 py-10 text-xs">No episodes found.</div>
          )}
        </div>
      </div>
    );
  };

  // Subtitles Options List
  const renderSubtitlesTab = () => {
    return (
      <div className="space-y-4">
        {/* Subtitle Delay Sync Card */}
        <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300">Subtitle Sync</span>
            <span className="text-xs font-mono font-bold text-red-500">
              {subtitleDelay === 0 ? 'No Delay' : `${subtitleDelay > 0 ? '+' : ''}${subtitleDelay.toFixed(1)}s`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSubtitleDelay(prev => Math.max(-10, prev - 0.5))}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer"
            >
              -0.5s
            </button>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.1}
              value={subtitleDelay}
              onChange={(e) => setSubtitleDelay(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-600 outline-none"
            />
            <button
              onClick={() => setSubtitleDelay(prev => Math.min(10, prev + 0.5))}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-extrabold text-[10px] rounded-lg transition-colors cursor-pointer"
            >
              +0.5s
            </button>
          </div>
          {subtitleDelay !== 0 && (
            <button
              onClick={() => setSubtitleDelay(0)}
              className="w-full text-center text-[10px] font-bold text-zinc-400 hover:text-white transition-colors py-1 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
            >
              Reset Sync
            </button>
          )}
        </div>

        <button
          onClick={() => setActiveSubtitle('none')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${activeSubtitle === 'none' ? 'bg-red-600/10 border-red-600 text-red-500' : 'bg-zinc-900/40 border-white/5 text-white hover:bg-zinc-900/60'}`}
        >
          <span>Off</span>
          <span className="text-[9px] uppercase font-extrabold tracking-widest text-zinc-500 bg-black/40 px-2 py-0.5 rounded">No Subtitles</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 text-xs font-bold text-white transition-all cursor-pointer"
        >
          <Upload size={14} />
          <span>Upload subtitles</span>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleSubtitleUpload}
            accept=".vtt,.srt"
            className="hidden"
          />
        </button>

        <div className="space-y-2">
          {subtitles.map((sub, idx) => {
            const isActive = activeSubtitle === sub.lang;
            const isBuiltIn = !sub.lang.startsWith('uploaded-');
            return (
              <button
                key={idx}
                onClick={() => setActiveSubtitle(sub.lang)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-red-600/15 border-red-600 text-red-500' : 'bg-zinc-900/40 border-white/5 text-white hover:bg-zinc-900/60'}`}
              >
                <div className="flex items-center gap-2">
                  {isActive && <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_#e50914]" />}
                  <span>{sub.label}</span>
                </div>
                <span className="text-[9px] uppercase font-extrabold tracking-widest text-zinc-500 bg-black/40 px-2 py-0.5 rounded">
                  {isBuiltIn ? 'Built-in' : 'Custom'}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setActiveDrawer('sub-opensubtitles')}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 text-xs font-bold text-white transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <Search size={14} className="text-zinc-400 group-hover:text-white transition-colors" />
            <span>Search on OpenSubtitles</span>
          </div>
          <ChevronRight size={14} className="text-zinc-400 group-hover:text-white transition-colors" />
        </button>

        <button
          onClick={() => setActiveDrawer('sub-appearance')}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 text-xs font-bold text-white transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <Sliders size={14} className="text-zinc-400 group-hover:text-white transition-colors" />
            <span>Customize Appearance</span>
          </div>
          <ChevronRight size={14} className="text-zinc-400 group-hover:text-white transition-colors" />
        </button>
      </div>
    );
  };

  // Speed Settings
  const renderSpeedTab = () => {
    return (
      <div className="space-y-2">
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => {
          const isActive = playbackRate === rate;
          const label = rate === 1 ? '1x (Normal)' : `${rate}x`;
          return (
            <button
              key={rate}
              onClick={() => {
                if (videoRef.current) videoRef.current.playbackRate = rate;
                setPlaybackRate(rate);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-red-600/15 border-red-600 text-red-500' : 'bg-zinc-900/40 border-white/5 text-white hover:bg-zinc-900/60'}`}
            >
              <span>{label}</span>
              {isActive && <span className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_10px_#e50914]" />}
            </button>
          );
        })}
      </div>
    );
  };

  // Quality Settings
  const renderQualityTab = () => {
    return (
      <div className="space-y-2">
        <button
          onClick={() => {
            if (hlsRef.current) hlsRef.current.nextLevel = -1;
            setCurrentLevelIndex(-1);
          }}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${currentLevelIndex === -1 ? 'bg-red-600/15 border-red-600 text-red-500' : 'bg-zinc-900/40 border-white/5 text-white hover:bg-zinc-900/60'}`}
        >
          <span>Auto</span>
          {currentLevelIndex === -1 && <span className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_10px_#e50914]" />}
        </button>

        {hlsLevels.length > 0 ? (
          [...hlsLevels].reverse().map((level, idx) => {
            const originalIndex = hlsLevels.length - 1 - idx;
            const isActive = currentLevelIndex === originalIndex;
            return (
              <button
                key={originalIndex}
                onClick={() => {
                  if (hlsRef.current) hlsRef.current.nextLevel = originalIndex;
                  setCurrentLevelIndex(originalIndex);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-red-600/15 border-red-600 text-red-500' : 'bg-zinc-900/40 border-white/5 text-white hover:bg-zinc-900/60'}`}
              >
                <span>{level.height}p</span>
                {isActive && <span className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_10px_#e50914]" />}
              </button>
            );
          })
        ) : (
          <div className="text-center text-zinc-500 py-10 text-xs">Standard stream source (Quality not adjustable).</div>
        )}
      </div>
    );
  };

  // Audio / Language Track Selector
  const renderAudioTab = () => {
    return (
      <div className="space-y-2">
        {Array.from(new Set(availableStreams.map(s => s.language))).map((lang) => {
          const stream = availableStreams.find(s => s.language === lang && !failedStreamUrls.has(s.sourceUrl));
          if (!stream) return null;
          const isActive = currentLanguage === lang;
          return (
            <button
              key={lang}
              onClick={() => {
                handleHotSwap(lang, stream.sourceUrl);
                setActiveDrawer(null); // close on select to watch loading
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-red-600/15 border-red-600 text-red-500' : 'bg-zinc-900/40 border-white/5 text-white hover:bg-zinc-900/60'}`}
            >
              <span>{getLanguageName(lang)}</span>
              {isActive && <span className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_10px_#e50914]" />}
            </button>
          );
        })}
      </div>
    );
  };

  // Servers / Stream Source switching
  const renderServersTab = () => {
    const availableServers = [
      {
        id: 'omniflow_direct',
        name: 'OmniFlow Player (Premium HLS)',
        recommended: true
      },
      ...seasonsList.length > 0 || mediaType === 'movie' ? [
        { id: 'vidsrc-icu', name: 'VidSrc ICU (CDN 1)', recommended: false },
        { id: 'vidlink', name: 'VidLink (CDN 2)', recommended: false },
        { id: 'vidapi', name: 'VidAPI (CDN 3)', recommended: false }
      ] : []
    ];

    return (
      <div className="space-y-2">
        {availableServers.map((server) => {
          const isActive = activeServerId === server.id;
          return (
            <button
              key={server.id}
              onClick={() => {
                setActiveServer(server.id);
                setHotSwapToast(`Connecting to ${server.name}...`);
                setTimeout(() => setHotSwapToast(null), 3000);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left cursor-pointer ${isActive ? 'bg-red-600/15 border-red-600 text-red-500' : 'bg-zinc-900/40 border-white/5 text-white hover:bg-zinc-900/60'}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {isActive && <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_8px_#e50914]" />}
                  <span className="text-xs font-bold">{server.name}</span>
                  {server.recommended && (
                    <span className="text-[8px] font-extrabold bg-red-600/20 text-red-500 px-1.5 py-0.5 rounded uppercase tracking-wider">Fastest</span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">High-speed media extraction cluster</p>
              </div>
              <span className="text-[10px] text-zinc-400 font-bold">{isActive ? 'Connected' : 'Connect'}</span>
            </button>
          );
        })}
      </div>
    );
  };

  // Customize Subtitle Appearance Panel
  const renderAppearanceSubMenu = () => {
    return (
      <div className="flex flex-col h-full text-white">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveDrawer('settings'); setSettingsTab('subtitles'); }}
              className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-xs font-bold uppercase tracking-wider">Subtitle Appearance</span>
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            className="hover:bg-white/10 p-1.5 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5 text-left">
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-zinc-300">
              <span>Font Size</span>
              <span className="text-zinc-400">{subtitleSettings.fontSize}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={48}
              value={subtitleSettings.fontSize}
              onChange={(e) => updateSubtitleSettings({ fontSize: Number(e.target.value) })}
              className="w-full accent-red-600 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-zinc-300">
              <span>Background Opacity</span>
              <span className="text-zinc-400">{Math.round(subtitleSettings.backgroundOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={subtitleSettings.backgroundOpacity}
              onChange={(e) => updateSubtitleSettings({ backgroundOpacity: Number(e.target.value) })}
              className="w-full accent-red-600 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer outline-none"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-300 block">Font Color</span>
            <div className="flex gap-2 flex-wrap">
              {[
                { name: 'White', value: '#ffffff' },
                { name: 'Yellow', value: '#ffff00' },
                { name: 'Cyan', value: '#00ffff' },
                { name: 'Green', value: '#00ff00' }
              ].map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateSubtitleSettings({ fontColor: color.value })}
                  style={{ backgroundColor: color.value }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${subtitleSettings.fontColor === color.value ? 'border-red-600 scale-110' : 'border-transparent hover:scale-105'}`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-zinc-300">
              <span>Outline Width</span>
              <span className="text-zinc-400">{subtitleSettings.outlineWidth}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              value={subtitleSettings.outlineWidth}
              onChange={(e) => updateSubtitleSettings({ outlineWidth: Number(e.target.value) })}
              className="w-full accent-red-600 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer outline-none"
            />
          </div>
        </div>
      </div>
    );
  };

  // OpenSubtitles Search Panel
  const renderOpenSubtitlesSubMenu = () => {
    return (
      <div className="flex flex-col h-full text-white">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveDrawer('settings'); setSettingsTab('subtitles'); }}
              className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-xs font-bold uppercase tracking-wider">Search OpenSubtitles</span>
          </div>
          <button
            onClick={() => setActiveDrawer(null)}
            className="hover:bg-white/10 p-1.5 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
          <div className="bg-zinc-900/40 p-4 rounded-xl border border-white/5 text-left">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Find subtitles from the community. Search results are based on the current title: <strong className="text-white">{mediaTitle}</strong>
            </p>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              defaultValue={mediaTitle || ''}
              placeholder="Query"
              className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors"
            />
            <button className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer">
              Search
            </button>
          </div>

          <div className="space-y-2 pt-2 text-left">
            <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-sans">Results</h5>
            <div className="text-zinc-400 text-xs text-center py-10 font-sans">No external subtitles returned for this query.</div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsDrawer = () => {
    return (
      <div className="flex flex-col h-full text-white">
        {/* Tab Bar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2 bg-zinc-950/80">
          <div className="flex gap-1 bg-zinc-900 p-0.5 rounded-full border border-white/5 flex-1 max-w-[90%] overflow-x-auto no-scrollbar">
            {(['quality', 'subtitles', 'audio', 'servers', 'speed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSettingsTab(tab)}
                className={`flex-shrink-0 text-center py-1.5 px-3.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${settingsTab === tab ? 'bg-white text-black shadow-md' : 'text-zinc-400 hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={() => setActiveDrawer(null)}
            className="hover:bg-white/10 p-1.5 rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Content List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2.5">
          {settingsTab === 'subtitles' && renderSubtitlesTab()}
          {settingsTab === 'speed' && renderSpeedTab()}
          {settingsTab === 'quality' && renderQualityTab()}
          {settingsTab === 'audio' && renderAudioTab()}
          {settingsTab === 'servers' && renderServersTab()}
        </div>
      </div>
    );
  };

  // Local helper variable definitions
  const currentEpisodeData = episodesList.find(ep => ep.number === episode);
  const currentEpisodeTitle = currentEpisodeData?.title || `Episode ${episode}`;
  const currentEpisodeOverview = currentEpisodeData?.overview || (mediaType === 'movie' ? 'Full Movie' : 'No description available.');

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
      <style>
        {`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 99px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.4);
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          @keyframes scaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
          .animate-scale-in {
            animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>

      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && !activeDrawer && setShowControls(false)}
        className="relative w-full h-full flex-1 min-h-0 overflow-hidden bg-black select-none group/player"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            !target.closest('button') && 
            !target.closest('input') && 
            !target.closest('a') && 
            !target.closest('select') &&
            !target.closest('.player-drawer')
          ) {
            if (activeDrawer) {
              setActiveDrawer(null);
            } else {
              handlePlayPause();
            }
          }
        }}
      >
        {iframeUrl ? (
          <iframe 
            src={iframeUrl} 
            className="w-full h-full border-0 absolute inset-0 z-30" 
            allowFullScreen 
            allow="autoplay; fullscreen"
          />
        ) : (
          <>
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
              onEnded={handleEnded}
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
          </>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-35">
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
        {!isPlaying && !isLoading && !adActive && !activeDrawer && !iframeUrl && (
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

        {/* ⏭️ Skip Intro / Outro Button (p-stream-inspired) */}
        {skipBtnVisible && !adActive && !iframeUrl && (skipBtnAlwaysVisible || showControls) && (
          <div className="absolute bottom-28 right-4 sm:right-6 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => {
                if (!videoRef.current || !skipTimes) return;
                const target = skipBtnVisible === 'intro' ? skipTimes.introEnd : (skipTimes.outroEnd || duration);
                videoRef.current.currentTime = target;
                setSkipBtnVisible(null);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/25 hover:border-white/40 rounded-xl text-white font-bold text-sm transition-all duration-200 hover:scale-105 shadow-2xl cursor-pointer group"
            >
              <SkipForward size={15} className="group-hover:translate-x-0.5 transition-transform" />
              {skipBtnVisible === 'intro' ? 'Skip Intro' : 'Skip Outro'}
            </button>
          </div>
        )}

        {/* ⏭️ Next Episode Countdown Overlay (p-stream-inspired) */}
        {showNextEpOverlay && hasNextEpisode && !adActive && !iframeUrl && (
          <div className="absolute bottom-28 right-4 sm:right-6 z-40 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3 p-3 pr-4 bg-black/80 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl">
              <div className="relative w-10 h-10 flex-shrink-0">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15" fill="none"
                    stroke="#ef4444" strokeWidth="3"
                    strokeDasharray={`${2 * Math.PI * 15}`}
                    strokeDashoffset={`${2 * Math.PI * 15 * (nextEpCountdown / 5)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">{nextEpCountdown}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-zinc-400 font-medium">Up Next</span>
                <span className="text-white font-bold text-sm">Episode {episode + 1}</span>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={() => {
                    nextEpCancelledRef.current = true;
                    if (nextEpCountdownRef.current) clearInterval(nextEpCountdownRef.current);
                    setShowNextEpOverlay(false);
                  }}
                  className="text-xs text-zinc-400 hover:text-white transition-colors border border-white/20 rounded-lg px-2 py-1 cursor-pointer hover:border-white/40"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (nextEpCountdownRef.current) clearInterval(nextEpCountdownRef.current);
                    setShowNextEpOverlay(false);
                    playNextEpisode();
                  }}
                  className="text-xs font-bold text-black bg-white hover:bg-zinc-100 rounded-lg px-3 py-1 transition-all cursor-pointer"
                >
                  Play Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top-Left Back Button */}
        <div className={`absolute top-4 left-4 z-40 transition-opacity duration-300 ${showControls || activeDrawer || iframeUrl ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <Link 
            href={getBackUrl()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white transition-colors cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft size={20} />
          </Link>
        </div>

        {/* Modern Controls Bar */}
        {!iframeUrl && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/95 via-black/70 to-transparent pt-32 pb-4 px-4 sm:px-6 flex flex-col gap-3 transition-all duration-300 ease-out ${
              (showControls && !adActive) || activeDrawer ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {/* Logo & Episode details inside the bottom overlay, above seek bar */}
            {!activeDrawer && (
              <div className="mb-2 max-w-lg md:max-w-2xl text-left select-text animate-in fade-in duration-300">
                {logoUrl ? (
                  <img src={logoUrl} alt={mediaTitle} className="h-14 md:h-20 object-contain mb-3" />
                ) : (
                <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2 uppercase italic font-display">{mediaTitle}</h2>
              )}
              
              <div className="text-xs md:text-sm font-semibold text-zinc-400 flex items-center gap-2 mb-1">
                <span>{mediaType === 'movie' ? 'Movie' : `Season ${season} • Episode ${episode}`}</span>
                <span>•</span>
                <span>{formatEpisodeDuration(duration)}</span>
              </div>
              
              <h3 className="text-sm md:text-base font-bold text-white mb-0.5">{currentEpisodeTitle}</h3>
              <p className="text-[11px] md:text-xs text-zinc-400 line-clamp-2 leading-relaxed max-w-xl">{currentEpisodeOverview}</p>
            </div>
          )}

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
                <div className="h-full bg-red-600 relative" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
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
                {isPlaying ? <Pause size={22} className="fill-white" /> : <Play size={22} className="fill-white" />}
              </button>
              
              <button onClick={() => handleSkip(-10)} className="text-white/80 hover:text-white transition-colors flex items-center relative" title="Rewind 10s">
                <RotateCcw size={20} />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
              </button>
              <button onClick={() => handleSkip(10)} className="text-white/80 hover:text-white transition-colors flex items-center relative" title="Forward 10s">
                <RotateCw size={20} />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mt-0.5">10</span>
              </button>

              <div className="flex items-center gap-2 group/volume ml-2">
                <button onClick={toggleMute} className="text-white hover:scale-110 transition-transform cursor-pointer">
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                  className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Right side controllers */}
            <div className="flex items-center gap-3 sm:gap-4 relative">
              {/* Skip Next Episode Button */}
              {(episodesList.length > 0 && (episode < episodesList.length || seasonsList.some(s => s.season_number === season + 1))) && (
                <button onClick={playNextEpisode} className="text-white/80 hover:text-white transition-colors cursor-pointer" title="Next Episode">
                  <SkipForward size={20} />
                </button>
              )}

              {/* Episodes Button */}
              {mediaType !== 'movie' && (
                <button 
                  onClick={() => setActiveDrawer(activeDrawer === 'episodes' ? null : 'episodes')}
                  className={`flex items-center gap-1.5 hover:text-white transition-colors font-bold text-xs uppercase tracking-wider cursor-pointer ${activeDrawer === 'episodes' ? 'text-red-500' : 'text-white/90'}`}
                >
                  <ListVideo size={18} />
                  <span>Episodes</span>
                </button>
              )}

              {/* Subtitles Button */}
              <button 
                onClick={() => {
                  if (activeDrawer === 'settings' && settingsTab === 'subtitles') {
                    setActiveDrawer(null);
                  } else {
                    setActiveDrawer('settings');
                    setSettingsTab('subtitles');
                  }
                }} 
                className={`hover:text-red-500 transition-colors cursor-pointer ${activeDrawer === 'settings' && settingsTab === 'subtitles' ? 'text-red-500' : 'text-white'}`}
                title="Subtitles"
              >
                <Subtitles size={20} />
              </button>

              {/* Settings Button */}
              <button 
                onClick={() => {
                  if (activeDrawer === 'settings' && settingsTab === 'speed') {
                    setActiveDrawer(null);
                  } else {
                    setActiveDrawer('settings');
                    setSettingsTab('speed');
                  }
                }} 
                className={`hover:scale-110 transition-transform cursor-pointer ${activeDrawer === 'settings' && settingsTab !== 'subtitles' ? 'text-red-500' : 'text-white/90'}`}
                title="Settings"
              >
                <Settings size={20} />
              </button>

              {/* Theater Mode & PiP & Fullscreen */}
              <div className="flex items-center gap-3 sm:gap-4 ml-1 pl-1 border-l border-white/10">
                <button onClick={togglePiP} className={`hover:text-white transition-colors cursor-pointer ${isPiP ? 'text-red-500' : 'text-white/90'}`} title="Picture in Picture">
                  <PictureInPicture size={18} />
                </button>
                <button onClick={() => setIsTheaterMode(p => !p)} className={`hover:text-white transition-colors cursor-pointer hidden md:block ${isTheaterMode ? 'text-red-500' : 'text-white/90'}`} title="Theater Mode">
                  <Monitor size={18} />
                </button>
                <button onClick={toggleFullscreen} className="text-white/90 hover:text-white hover:scale-110 transition-transform cursor-pointer" title="Fullscreen">
                  {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Dimming overlay behind drawer */}
        {activeDrawer && (
          <div 
            onClick={() => setActiveDrawer(null)}
            className="absolute inset-0 bg-black/65 z-[45] backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
          />
        )}

        {/* Drawer container (Overlay right drawer) */}
        {activeDrawer && (
          <div className="absolute top-0 right-0 h-full w-full sm:w-[420px] bg-zinc-950/95 border-l border-white/10 z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-right duration-300 player-drawer">
            {activeDrawer === 'episodes' && renderEpisodesDrawer()}
            {activeDrawer === 'settings' && renderSettingsDrawer()}
            {activeDrawer === 'sub-appearance' && renderAppearanceSubMenu()}
            {activeDrawer === 'sub-opensubtitles' && renderOpenSubtitlesSubMenu()}
          </div>
        )}
        
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
