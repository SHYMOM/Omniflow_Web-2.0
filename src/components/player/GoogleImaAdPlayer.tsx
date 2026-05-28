'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Volume2, VolumeX, ExternalLink } from 'lucide-react';

interface GoogleImaAdPlayerProps {
  onComplete: () => void;
  isStreamReady?: boolean;
}

// High-speed fallback video (Google Chromecast sample - loops endlessly)
const FALLBACK_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const FALLBACK_CLICK_URL = 'https://github.com/SHYMOM/Omniflow_Web-2.0';

export default function GoogleImaAdPlayer({ onComplete, isStreamReady = false }: GoogleImaAdPlayerProps) {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  
  const adsManagerRef = useRef<any>(null);
  const adsLoaderRef = useRef<any>(null);
  const adDisplayContainerRef = useRef<any>(null);
  const completedRef = useRef(false);

  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [adStatus, setAdStatus] = useState<'loading' | 'ready' | 'requesting' | 'playing' | 'fallback' | 'waiting_for_stream' | 'error'>('loading');
  const [adFinished, setAdFinished] = useState(false);
  const [fallbackMuted, setFallbackMuted] = useState(true); // Start muted to ensure 100% autoplay success

  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || 'pub-4822969695751643';

  // Stable onComplete that only fires once
  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // Handles transition when the ad finishes, checking if the stream is ready
  const handleAdPlaybackFinished = useCallback(() => {
    setAdFinished(true);
    if (isStreamReady) {
      handleComplete();
    } else {
      setAdStatus('waiting_for_stream');
    }
  }, [isStreamReady, handleComplete]);

  // Monitor stream resolution and transition once ready
  useEffect(() => {
    if (adFinished && isStreamReady) {
      handleComplete();
    }
  }, [adFinished, isStreamReady, handleComplete]);

  // Step 1: Dynamically load the Google IMA SDK script
  useEffect(() => {
    if ((window as any).google?.ima) {
      setSdkLoaded(true);
      setAdStatus('ready');
      return;
    }

    const existing = document.querySelector('script[src*="imasdk.googleapis.com"]');
    if (existing) {
      const checkInterval = setInterval(() => {
        if ((window as any).google?.ima) {
          setSdkLoaded(true);
          setAdStatus('ready');
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
    script.async = true;
    script.onload = () => {
      setSdkLoaded(true);
      setAdStatus('ready');
    };
    script.onerror = () => {
      console.warn('[IMA] SDK blocked. Using unblockable fallback ad.');
      setSdkLoaded(false);
      setAdStatus('ready'); // Still trigger fallback on ready status
    };
    document.head.appendChild(script);
  }, []);

  // Step 2: Auto-trigger ad playback once the SDK loader resolves
  useEffect(() => {
    if (adStatus === 'ready') {
      handleStartPlayback();
    }
  }, [adStatus]);

  // Playback initialization handler - runs automatically
  const handleStartPlayback = () => {
    setAdStatus('requesting');
    const google = (window as any).google;

    // If IMA SDK is blocked or undefined, directly trigger the fallback ad
    if (!google?.ima) {
      startFallbackAd();
      return;
    }

    try {
      // 1. Initialize AdDisplayContainer
      const adDisplayContainer = new google.ima.AdDisplayContainer(
        adContainerRef.current!,
        adVideoRef.current!
      );
      adDisplayContainerRef.current = adDisplayContainer;
      adDisplayContainer.initialize();

      // 2. Create AdsLoader
      const adsLoader = new google.ima.AdsLoader(adDisplayContainer);
      adsLoaderRef.current = adsLoader;

      // 3. Listen for AdsManagerLoadedEvent
      adsLoader.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (event: any) => {
          const adsRenderingSettings = new google.ima.AdsRenderingSettings();
          adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;

          const adsManager = event.getAdsManager(adVideoRef.current!, adsRenderingSettings);
          adsManagerRef.current = adsManager;

          // Event bindings
          adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, (err: any) => {
            console.warn('[IMA] Ad Error during play. Triggering fallback ad.', err.getError().toString());
            startFallbackAd();
          });

          adsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, () => {
            setAdStatus('playing');
          });

          adsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, () => {
            handleAdPlaybackFinished();
          });

          adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
            handleAdPlaybackFinished();
          });

          adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => {
            setAdStatus('playing');
          });

          adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, () => {
            handleAdPlaybackFinished();
          });

          try {
            const width = adContainerRef.current?.clientWidth || 640;
            const height = adContainerRef.current?.clientHeight || 360;
            adsManager.init(width, height, google.ima.ViewMode.NORMAL);
            adsManager.start();
          } catch (startError) {
            console.error('[IMA] AdsManager start failed. Triggering fallback.', startError);
            startFallbackAd();
          }
        },
        false
      );

      // Listen for loader error
      adsLoader.addEventListener(
        google.ima.AdErrorEvent.Type.AD_ERROR,
        (event: any) => {
          console.warn('[IMA] AdsLoader error. Triggering fallback.', event.getError().toString());
          startFallbackAd();
        },
        false
      );

      // 4. Request Ads
      const adsRequest = new google.ima.AdsRequest();
      
      // Determine ad tag based on environment (use official Google skippable linear test tag on localhost to guarantee rendering)
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

      if (isLocalhost) {
        adsRequest.adTagUrl = `https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319075/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dskippablelinear&correlator=${Date.now()}`;
      } else {
        const cleanPubId = publisherId.replace('pub-', '');
        adsRequest.adTagUrl =
          `https://googleads.g.doubleclick.net/pagead/ads?` +
          `ad_type=video&client=ca-video-pub-${cleanPubId}&` +
          `videoad_start_delay=0&` +
          `description_url=${encodeURIComponent(window.location.href)}&` +
          `max_ad_duration=30000&` +
          `vad_type=linear&` +
          `correlator=${Date.now()}`;
      }

      // Slot sizes
      const slotW = adContainerRef.current!.clientWidth || 640;
      const slotH = adContainerRef.current!.clientHeight || 360;
      adsRequest.linearAdSlotWidth = slotW;
      adsRequest.linearAdSlotHeight = slotH;
      adsRequest.nonLinearAdSlotWidth = slotW;
      adsRequest.nonLinearAdSlotHeight = Math.floor(slotH / 3);

      adsRequest.setAdWillAutoPlay(true);
      adsRequest.setAdWillPlayMuted(true); // Request muted to guarantee autoplay compatibility in all browsers

      adsLoader.requestAds(adsRequest);
    } catch (e) {
      console.error('[IMA] Setup crashed. Triggering fallback.', e);
      startFallbackAd();
    }
  };

  // Triggers our own unblockable fallback HTML5 video ad
  const startFallbackAd = () => {
    setAdStatus('fallback');
    if (fallbackVideoRef.current) {
      fallbackVideoRef.current.src = FALLBACK_VIDEO_URL;
      fallbackVideoRef.current.muted = true;
      fallbackVideoRef.current.loop = true; // Loop endlessly until stream is ready
      fallbackVideoRef.current.play().catch(e => {
        console.warn('[IMA] Fallback autoplay failed.', e);
      });
    }
  };

  // Handle resize for Google IMA Manager
  useEffect(() => {
    const handleResize = () => {
      if (adsManagerRef.current && adContainerRef.current) {
        const google = (window as any).google;
        if (google?.ima) {
          const w = adContainerRef.current.clientWidth;
          const h = adContainerRef.current.clientHeight;
          adsManagerRef.current.resize(w, h, google.ima.ViewMode.NORMAL);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cleanup references on unmount
  useEffect(() => {
    return () => {
      if (adsManagerRef.current) {
        try { adsManagerRef.current.destroy(); } catch (_e) {}
      }
      if (adsLoaderRef.current) {
        try { adsLoaderRef.current.destroy(); } catch (_e) {}
      }
    };
  }, []);

  const toggleFallbackMute = () => {
    if (fallbackVideoRef.current) {
      fallbackVideoRef.current.muted = !fallbackVideoRef.current.muted;
      setFallbackMuted(fallbackVideoRef.current.muted);
    }
  };

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border/60 flex flex-col items-center justify-center font-sans select-none">
      {/* 1. INITIAL LOADING STATE */}
      {(adStatus === 'loading') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-40 p-6 text-center">
          <LoadingSpinner size={32} />
          <h3 className="text-xs font-bold text-white mt-4 uppercase tracking-widest animate-pulse">
            Initializing secure player...
          </h3>
        </div>
      )}

      {/* 2. GOOGLE IMA PLAYBACK CONTAINERS */}
      <div
        ref={adContainerRef}
        className={`absolute inset-0 w-full h-full z-20 ${adStatus === 'playing' ? 'block' : 'hidden'}`}
      />
      <video
        ref={adVideoRef}
        className={`absolute inset-0 w-full h-full object-cover z-10 ${adStatus === 'playing' ? 'block' : 'hidden'}`}
        playsInline
      />

      {/* 3. UNBLOCKABLE FALLBACK AD PLAYER */}
      {adStatus === 'fallback' && (
        <div className="absolute inset-0 w-full h-full z-30 bg-black">
          <video
            ref={fallbackVideoRef}
            className="w-full h-full object-cover"
            playsInline
            loop
          />

          {/* Top Info Banner */}
          <div className="absolute top-4 left-4 z-40 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-green bg-accent-green/20 px-1.5 py-0.5 rounded">Ad</span>
            <span className="text-xs text-white/80 font-medium">Featured Sponsor Campaign</span>
          </div>

          {/* Clickthrough link */}
          <a
            href={FALLBACK_CLICK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 left-4 z-40 bg-accent-green hover:bg-accent-green-hover text-black px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(0,230,118,0.3)] hover:translate-y-[-1px]"
          >
            Learn More
            <ExternalLink size={12} />
          </a>

          {/* Controls: Skip & Volume */}
          <div className="absolute bottom-4 right-4 z-40 flex items-center gap-3">
            <button
              onClick={toggleFallbackMute}
              className="w-9 h-9 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              {fallbackMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {isStreamReady ? (
              <button
                onClick={handleComplete}
                className="bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white font-semibold text-xs py-2 px-5 rounded-lg flex items-center gap-2 transition-colors animate-pulse"
              >
                Skip Ad
              </button>
            ) : (
              <div className="bg-black/70 backdrop-blur-md border border-white/20 text-white/60 font-semibold text-xs py-2 px-5 rounded-lg flex items-center gap-2 font-sans select-none">
                <LoadingSpinner size={12} />
                <span>Resolving stream...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. WAITING FOR STREAM RESOLUTION (After ad completes but before stream resolves) */}
      {adStatus === 'waiting_for_stream' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30">
          <LoadingSpinner size={40} />
          <span className="text-xs text-text-muted mt-4 font-semibold uppercase tracking-widest animate-pulse">
            Finalizing secure stream...
          </span>
          <span className="text-[10px] font-mono text-white/30 mt-2">
            Loading video chunks
          </span>
        </div>
      )}

      {/* 5. REQUESTING FEED STATE */}
      {(adStatus === 'requesting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30">
          <LoadingSpinner size={40} />
          <span className="text-xs text-text-muted mt-4 font-semibold uppercase tracking-widest animate-pulse">
            Requesting ad feed...
          </span>
          <span className="text-[10px] font-mono text-white/30 mt-2">
            Stream links resolving in background
          </span>
        </div>
      )}
    </div>
  );
}
