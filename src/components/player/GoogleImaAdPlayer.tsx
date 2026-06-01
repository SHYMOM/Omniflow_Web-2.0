'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Volume2, VolumeX, ExternalLink } from 'lucide-react';

interface GoogleImaAdPlayerProps {
  onComplete: () => void;
  isStreamReady?: boolean;
}

// High-speed fallback video (Google Chromecast sample - loops endlessly)
const FALLBACK_VIDEO_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const FALLBACK_CLICK_URL = 'https://github.com/SHYMOM/Omniflow_Web-2.0';

export default function GoogleImaAdPlayer({
  onComplete,
  isStreamReady = false,
}: GoogleImaAdPlayerProps) {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const adVideoRef = useRef<HTMLVideoElement>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const adsManagerRef = useRef<any>(null);
  const adsLoaderRef = useRef<any>(null);
  const adDisplayContainerRef = useRef<any>(null);

  // ── Stability refs ──────────────────────────────────────────────────────────
  const completedRef = useRef(false);

  /**
   * FIX 3 – React Strict Mode double-init guard.
   * In development, React 18 Strict Mode intentionally mounts → unmounts → remounts
   * every component. Without this guard, AdDisplayContainer.initialize() and
   * AdsLoader get created twice on the same DOM nodes, causing a fatal IMA SDK error.
   */
  const playbackStartedRef = useRef(false);

  /**
   * FIX 7 – Stale-closure guard for IMA event callbacks.
   * handleAdPlaybackFinished is registered as an event listener inside
   * handleStartPlayback. If isStreamReady later changes, the listener would
   * hold a stale closure value. Storing the latest version in a ref ensures
   * the listener always calls the current function without re-registering.
   */
  const handleAdPlaybackFinishedRef = useRef<() => void>(() => { });

  const [adStatus, setAdStatus] = useState<
    | 'loading'
    | 'ready'
    | 'requesting'
    | 'playing'
    | 'fallback'
    | 'waiting_for_stream'
    | 'error'
  >('loading');
  const [adFinished, setAdFinished] = useState(false);
  const [fallbackMuted, setFallbackMuted] = useState(true); // Start muted → guaranteed autoplay

  // FIX 6 – Removed dead `sdkLoaded` useState; the SDK presence is checked
  // directly via (window as any).google?.ima in handleStartPlayback, making
  // a parallel boolean state variable redundant and causing unnecessary re-renders.

  const publisherId =
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID || 'pub-4822969695751643';

  // ── Stable completion handler (fires exactly once) ─────────────────────────
  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  // ── Ad-finished transition ─────────────────────────────────────────────────
  const handleAdPlaybackFinished = useCallback(() => {
    setAdFinished(true);
    if (isStreamReady) {
      handleComplete();
    } else {
      setAdStatus('waiting_for_stream');
    }
  }, [isStreamReady, handleComplete]);

  // FIX 7 – Keep the ref in sync with the latest callback on every render so
  // the IMA event listener (registered once) always invokes the current version.
  useEffect(() => {
    handleAdPlaybackFinishedRef.current = handleAdPlaybackFinished;
  }, [handleAdPlaybackFinished]);

  // Monitor stream resolution after ad finishes
  useEffect(() => {
    if (adFinished && isStreamReady) {
      handleComplete();
    }
  }, [adFinished, isStreamReady, handleComplete]);

  // ── Step 1: Load the Google IMA SDK script ─────────────────────────────────
  useEffect(() => {
    if ((window as any).google?.ima) {
      setAdStatus('ready');
      return;
    }

    const existing = document.querySelector(
      'script[src*="imasdk.googleapis.com"]'
    );
    if (existing) {
      let attempts = 0;
      const checkInterval = setInterval(() => {
        if ((window as any).google?.ima) {
          setAdStatus('ready');
          clearInterval(checkInterval);
        } else if ((window as any).__imaFailed || attempts > 20) {
          console.warn('[IMA] SDK check timed out or blocked. Triggering fallback.');
          setAdStatus('ready');
          clearInterval(checkInterval);
        }
        attempts++;
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.src = 'https://imasdk.googleapis.com/js/sdkloader/ima3.js';
    script.async = true;
    script.onload = () => setAdStatus('ready');
    script.onerror = () => {
      // SDK blocked by an ad-blocker → surface the status so the next
      // effect can trigger the fallback immediately via handleStartPlayback.
      (window as any).__imaFailed = true;
      console.warn('[IMA] SDK blocked. Using unblockable fallback ad.');
      setAdStatus('ready');
    };
    document.head.appendChild(script);
  }, []);

  // ── Step 2: Auto-trigger playback once SDK resolves ────────────────────────
  useEffect(() => {
    if (adStatus !== 'ready') return;

    // FIX 3 – The guard prevents a second initialization in React Strict Mode.
    if (playbackStartedRef.current) return;
    playbackStartedRef.current = true;

    handleStartPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adStatus]);

  // ── Core playback initializer ──────────────────────────────────────────────
  const handleStartPlayback = () => {
    setAdStatus('requesting');
    const google = (window as any).google;

    if (!google?.ima) {
      startFallbackAd();
      return;
    }

    try {
      // ── 1. Create AdDisplayContainer ───────────────────────────────────────
      // FIX 1 – The container is always present in the DOM (opacity-0 instead of
      // display:none), so clientWidth/clientHeight are valid here. Previously,
      // hidden class (display:none) made these return 0, which caused adsManager
      // .init(0, 0) to crash immediately and silently fall through to the fallback.
      const adDisplayContainer = new google.ima.AdDisplayContainer(
        adContainerRef.current!,
        adVideoRef.current!
      );
      adDisplayContainerRef.current = adDisplayContainer;

      // FIX 4 – Browsers require initialize() to be called as a result of a
      // direct user gesture. On autoplay / programmatic start this will throw
      // a warning. Swallowing it lets the SDK attempt its own recovery instead
      // of crashing our entire setup flow.
      try {
        adDisplayContainer.initialize();
      } catch (e) {
        console.warn(
          '[IMA] Container init needs user gesture — SDK will attempt recovery.',
          e
        );
      }

      // ── 2. Create AdsLoader ────────────────────────────────────────────────
      const adsLoader = new google.ima.AdsLoader(adDisplayContainer);
      adsLoaderRef.current = adsLoader;

      // ── 3. AdsManagerLoaded ────────────────────────────────────────────────
      adsLoader.addEventListener(
        google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
        (event: any) => {
          const adsRenderingSettings = new google.ima.AdsRenderingSettings();
          adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;

          const adsManager = event.getAdsManager(
            adVideoRef.current!,
            adsRenderingSettings
          );
          adsManagerRef.current = adsManager;

          adsManager.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            (err: any) => {
              console.warn(
                '[IMA] Ad error during playback → fallback.',
                err.getError().toString()
              );
              startFallbackAd();
            }
          );

          adsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
            () => setAdStatus('playing')
          );

          // FIX 7 – Call via ref so the listener always uses the latest
          // isStreamReady value, not the stale closure from registration time.
          adsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
            () => handleAdPlaybackFinishedRef.current()
          );
          adsManager.addEventListener(
            google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            () => handleAdPlaybackFinishedRef.current()
          );
          adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () =>
            setAdStatus('playing')
          );
          adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, () =>
            handleAdPlaybackFinishedRef.current()
          );

          try {
            // FIX 1 – Dimensions are now valid because the element is in DOM.
            const width = adContainerRef.current?.clientWidth || 640;
            const height = adContainerRef.current?.clientHeight || 360;
            adsManager.init(width, height, google.ima.ViewMode.NORMAL);
            adsManager.start();
          } catch (startError) {
            console.error('[IMA] AdsManager.start() failed → fallback.', startError);
            startFallbackAd();
          }
        },
        false
      );

      // ── AdsLoader error ────────────────────────────────────────────────────
      adsLoader.addEventListener(
        google.ima.AdErrorEvent.Type.AD_ERROR,
        (event: any) => {
          console.warn(
            '[IMA] AdsLoader error → fallback.',
            event.getError().toString()
          );
          startFallbackAd();
        },
        false
      );

      // ── 4. Build & send AdsRequest ─────────────────────────────────────────
      const adsRequest = new google.ima.AdsRequest();

      const hostname =
        typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const isLocalhost =
        hostname === 'localhost' || hostname === '127.0.0.1';

      if (isLocalhost) {
        // Official Google skippable-linear test tag — always renders on localhost
        adsRequest.adTagUrl =
          `https://pubads.g.doubleclick.net/gampad/ads` +
          `?sz=640x480&iu=/124319075/external/single_ad_samples` +
          `&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast` +
          `&unviewed_position_start=1` +
          `&cust_params=deployment%3Ddevsite%26sample_ct%3Dskippablelinear` +
          `&correlator=${Date.now()}`;
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

      // FIX 1 – These also benefit from non-zero dimensions now.
      const slotW = adContainerRef.current!.clientWidth || 640;
      const slotH = adContainerRef.current!.clientHeight || 360;
      adsRequest.linearAdSlotWidth = slotW;
      adsRequest.linearAdSlotHeight = slotH;
      adsRequest.nonLinearAdSlotWidth = slotW;
      adsRequest.nonLinearAdSlotHeight = Math.floor(slotH / 3);
      adsRequest.setAdWillAutoPlay(true);
      adsRequest.setAdWillPlayMuted(true);
      adsLoader.requestAds(adsRequest);
    } catch (e) {
      console.error('[IMA] Setup crashed → fallback.', e);
      startFallbackAd();
    }
  };

  // ── Fallback HTML5 ad ──────────────────────────────────────────────────────
  const startFallbackAd = () => setAdStatus('fallback');

  useEffect(() => {
    if (adStatus === 'fallback' && fallbackVideoRef.current) {
      fallbackVideoRef.current.src = FALLBACK_VIDEO_URL;
      fallbackVideoRef.current.muted = true;
      fallbackVideoRef.current.loop = true;
      fallbackVideoRef.current
        .play()
        .catch((e) => console.warn('[IMA] Fallback autoplay failed.', e));
    }
  }, [adStatus]);

  // ── Resize handler for IMA ─────────────────────────────────────────────────
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

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { adsManagerRef.current?.destroy(); } catch (_e) { }
      try { adsLoaderRef.current?.destroy(); } catch (_e) { }
      try { adDisplayContainerRef.current?.destroy(); } catch (_e) { }
    };
  }, []);

  // ── Fallback mute toggle ───────────────────────────────────────────────────
  const toggleFallbackMute = () => {
    if (fallbackVideoRef.current) {
      fallbackVideoRef.current.muted = !fallbackVideoRef.current.muted;
      setFallbackMuted(fallbackVideoRef.current.muted);
    }
  };

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border/60 flex flex-col items-center justify-center font-sans select-none">

      {/* ── 1. INITIAL LOADING STATE ─────────────────────────────────────────── */}
      {adStatus === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-40 p-6 text-center">
          <LoadingSpinner size={32} />
          <h3 className="text-xs font-bold text-white mt-4 uppercase tracking-widest animate-pulse">
            Initializing secure player...
          </h3>
        </div>
      )}

      {/* ── 2. GOOGLE IMA CONTAINERS ─────────────────────────────────────────── */}
      {/*
        FIX 1 – CRITICAL: Replace Tailwind `hidden` (display:none) with
        opacity-0/pointer-events-none. The element MUST remain in the DOM at all
        times so that clientWidth/clientHeight are non-zero when the IMA SDK reads
        them in adsManager.init(). With display:none those values return 0, causing
        adsManager.init(0, 0) to throw and silently route to the fallback ad.
      */}
      <div
        ref={adContainerRef}
        className={`absolute inset-0 w-full h-full z-20 transition-opacity duration-150 ${adStatus === 'playing'
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
          }`}
      />

      {/*
        FIX 1 + FIX 2:
        - Same opacity strategy as the container above.
        - `muted` attribute is required at the DOM level. setAdWillPlayMuted(true)
          only informs the SDK of intent; Chrome and iOS Safari enforce autoplay
          policy at the HTML element level. Without this attribute the browser
          blocks .play(), IMA catches an AdError, and falls back immediately.
      */}
      <video
        ref={adVideoRef}
        className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-150 ${adStatus === 'playing' ? 'opacity-100' : 'opacity-0'
          }`}
        playsInline
        muted // FIX 2 – required for browser-level autoplay policy compliance
      />

      {/* ── 3. FALLBACK AD PLAYER ────────────────────────────────────────────── */}
      {adStatus === 'fallback' && (
        <div className="absolute inset-0 w-full h-full z-30 bg-black">
          <video
            ref={fallbackVideoRef}
            className="w-full h-full object-cover"
            playsInline
            loop
            muted
          />

          {/* Top Info Banner */}
          <div className="absolute top-4 left-4 z-40 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-green bg-accent-green/20 px-1.5 py-0.5 rounded">
              Ad
            </span>
            <span className="text-xs text-white/80 font-medium">
              Featured Sponsor Campaign
            </span>
          </div>

          {/* Clickthrough CTA */}
          <a
            href={FALLBACK_CLICK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 left-4 z-40 bg-accent-green hover:bg-accent-green-hover text-black px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(0,230,118,0.3)] hover:translate-y-[-1px]"
          >
            Learn More
            <ExternalLink size={12} />
          </a>

          {/* Controls: Volume & Skip */}
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
              <div className="bg-black/70 backdrop-blur-md border border-white/20 text-white/60 font-semibold text-xs py-2 px-5 rounded-lg flex items-center gap-2 select-none">
                <LoadingSpinner size={12} />
                <span>Resolving stream...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. WAITING FOR STREAM RESOLUTION ────────────────────────────────── */}
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

      {/* ── 5. REQUESTING FEED STATE ─────────────────────────────────────────── */}
      {/*
        FIX 5 – This overlay already used conditional rendering in the original
        (adStatus === 'requesting'), so it correctly unmounts the moment the IMA
        SDK fires STARTED and status becomes 'playing'. The IMA native skip button
        and click-through overlay are now fully accessible with no z-index blocker.
      */}
      {adStatus === 'requesting' && (
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