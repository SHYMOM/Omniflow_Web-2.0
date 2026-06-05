import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/store/playerStore';

interface UseHotSwapProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  hlsRef: React.MutableRefObject<any>;
  setIsLoading: (loading: boolean) => void;
}

export function useHotSwap({ videoRef, hlsRef, setIsLoading }: UseHotSwapProps) {
  const { currentStreamUrl, setCurrentLanguage, setHotSwapToast } = usePlayerStore();
  
  const hotSwapTimeRef = useRef<number | null>(null);
  const hotSwapRateRef = useRef<number>(1);
  const hotSwapVolumeRef = useRef<number | undefined>(undefined);
  const hotSwapToastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleHotSwap = (lang: string, url: string, languageName: string) => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    // 1. Save playback state
    hotSwapTimeRef.current = video.currentTime;
    hotSwapRateRef.current = video.playbackRate || 1;
    hotSwapVolumeRef.current = video.volume;

    // 2. Show toast
    setHotSwapToast(`Switching to ${languageName}...`);
    if (hotSwapToastTimerRef.current) clearTimeout(hotSwapToastTimerRef.current);
    hotSwapToastTimerRef.current = setTimeout(() => setHotSwapToast(null), 4000);

    // 3. Destroy current hls
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 4. Update state — the streamUrl useEffect will re-initialize hls in the parent VideoPlayer
    setCurrentLanguage(lang);
    setIsLoading(true);
    usePlayerStore.getState().setCurrentStreamUrl(url); // Trigger global stream update
  };

  return {
    handleHotSwap,
    hotSwapTimeRef,
    hotSwapRateRef,
    hotSwapVolumeRef
  };
}
