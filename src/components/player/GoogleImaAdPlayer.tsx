'use client';
import { useEffect, useState, useMemo } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Volume2, VolumeX, ExternalLink } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface GoogleImaAdPlayerProps {
  onComplete: () => void;
  isStreamReady?: boolean;
  mediaId?: string;
  mediaType?: string;
}

export default function GoogleImaAdPlayer({
  onComplete,
  isStreamReady = false,
  mediaId,
  mediaType,
}: GoogleImaAdPlayerProps) {
  const [adStatus, setAdStatus] = useState<'loading' | 'custom_ad' | 'waiting_for_stream'>('loading');
  const [customMuted, setCustomMuted] = useState(true);
  const [customAdData, setCustomAdData] = useState<any>(null);
  
  // We use Supabase to check for admin-created ads
  const supabase = useMemo(() => createClient(), []);

  // Handle immediate or delayed completion
  const handleSkipOrComplete = () => {
    if (isStreamReady) {
      onComplete();
    } else {
      setAdStatus('waiting_for_stream');
    }
  };

  // If we're waiting for the stream and it suddenly becomes ready, complete the ad sequence.
  useEffect(() => {
    if (adStatus === 'waiting_for_stream' && isStreamReady) {
      onComplete();
    }
  }, [adStatus, isStreamReady, onComplete]);

  useEffect(() => {
    let mounted = true;
    
    const fetchCustomAd = async () => {
      const adTimeout = setTimeout(() => {
        if (mounted && adStatus === 'loading') {
          console.warn('Ad resolution timed out, skipping to video playback.');
          handleSkipOrComplete();
        }
      }, 2500);

      try {
        // 1. Check if global ads are disabled
        const { data: settingsData } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'global_ads_enabled')
          .single();
          
        if (settingsData && (settingsData.value === 'false' || settingsData.value === false)) {
          clearTimeout(adTimeout);
          if (mounted) handleSkipOrComplete();
          return;
        }

        // 2. Fetch media-specific ad
        let adData = null;
        if (mediaId) {
          const { data } = await supabase
            .from('media_ads')
            .select('*')
            .eq('media_id', mediaId)
            .eq('is_active', true)
            .maybeSingle();
          adData = data;
        }

        // 3. Fallback to global ad
        if (!adData) {
          const { data } = await supabase
            .from('media_ads')
            .select('*')
            .eq('is_global', true)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          adData = data;
        }

        clearTimeout(adTimeout);
        if (adData && mounted) {
          setCustomAdData(adData);
          setAdStatus('custom_ad');
        } else {
          // If no admin ads are configured, just skip straight to video
          if (mounted) handleSkipOrComplete();
        }
      } catch (err) {
        clearTimeout(adTimeout);
        console.error('Failed to fetch custom ads', err);
        if (mounted) handleSkipOrComplete();
      }
    };
    
    fetchCustomAd();
    return () => { mounted = false; };
  }, [mediaId, supabase]);

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black flex flex-col items-center justify-center font-sans select-none">
      
      {adStatus === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-40 p-6 text-center">
          <LoadingSpinner size={32} />
          <h3 className="text-xs font-bold text-white mt-4 uppercase tracking-widest animate-pulse">
            Loading...
          </h3>
        </div>
      )}

      {adStatus === 'custom_ad' && customAdData && (
        <div className="absolute inset-0 w-full h-full z-30 bg-black flex items-center justify-center">
          {customAdData.video_url ? (
            <video
              src={customAdData.video_url}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              loop
              muted={customMuted}
              onEnded={() => {
                if (isStreamReady) onComplete();
                else setAdStatus('waiting_for_stream');
              }}
            />
          ) : (
            <img 
              src={customAdData.image_url} 
              alt={customAdData.title}
              className="w-full h-full object-cover"
              onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/1280x720?text=Ad')}
            />
          )}
          
          {/* Top Info Banner */}
          <div className="absolute top-4 left-4 z-40 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent-green bg-accent-green/20 px-1.5 py-0.5 rounded">
              Sponsor
            </span>
            <span className="text-xs text-white/80 font-medium">
              {customAdData.title}
            </span>
          </div>

          {/* Clickthrough CTA */}
          <a
            href={customAdData.target_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 left-4 z-40 bg-accent-green hover:bg-accent-green-hover text-black px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(0,230,118,0.3)] hover:translate-y-[-1px]"
          >
            Learn More
            <ExternalLink size={12} />
          </a>

          {/* Controls: Skip & Volume */}
          <div className="absolute bottom-4 right-4 z-40 flex items-center gap-3">
            {customAdData.video_url && (
              <button
                onClick={() => setCustomMuted(!customMuted)}
                className="w-9 h-9 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                {customMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            )}

            {isStreamReady ? (
              <button
                onClick={onComplete}
                className="bg-black/80 hover:bg-black backdrop-blur-md border border-white/20 text-white font-semibold text-xs py-2 px-5 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
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

      {adStatus === 'waiting_for_stream' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-30">
          <LoadingSpinner size={40} />
          <span className="text-xs text-text-muted mt-4 font-semibold uppercase tracking-widest animate-pulse">
            Finalizing stream...
          </span>
        </div>
      )}
    </div>
  );
}