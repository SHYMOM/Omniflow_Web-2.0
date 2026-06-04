import { useState } from 'react';
import { X, Copy, Check, Download } from 'lucide-react';

export interface StreamSubtitle {
  label: string;
  url: string;
  lang: string;
  default?: boolean;
}

export interface HlsQualityLevel {
  height: number;
  bitrate: number;
}

export interface HlsAudioTrack {
  id: number;
  name: string;
  language: string;
}

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamUrl: string | null;
  downloadUrl: string | null;
  hlsLevels: HlsQualityLevel[];
  audioTracks: HlsAudioTrack[];
  subtitles: StreamSubtitle[];
  availableLangs: string[];
  currentLanguage: string;
}

export default function DownloadModal({
  isOpen, onClose, streamUrl, downloadUrl, hlsLevels, audioTracks, subtitles, availableLangs, currentLanguage
}: DownloadModalProps) {
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [selectedAudio, setSelectedAudio] = useState<string>(currentLanguage);
  const [selectedSub, setSelectedSub] = useState<string>('none');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate final link based on selections
  const generateFinalLink = () => {
    if (!streamUrl) return '';
    let base = downloadUrl || streamUrl;
    
    // Convert to download proxy if possible
    if (base.includes('/api/stream/proxy')) {
      base = base.replace('/api/stream/proxy', '/api/download');
    } else if (base.startsWith('http')) {
      base = `/api/download?url=${encodeURIComponent(base)}`;
    }
    
    try {
      const url = new URL(base.startsWith('http') ? base : window.location.origin + base);
      
      if (selectedQuality !== -1) {
         url.searchParams.set('q', selectedQuality.toString());
      }
      if (selectedAudio) {
         url.searchParams.set('audio', selectedAudio);
      }
      if (selectedSub !== 'none') {
         url.searchParams.set('sub', selectedSub);
      }
      
      return url.toString();
    } catch (e) {
      return base;
    }
  };

  const finalLink = generateFinalLink();

  const handleCopy = () => {
    navigator.clipboard.writeText(finalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans" onClick={onClose}>
      <div 
        className="bg-void border border-border/60 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">Download Configurator</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Quality */}
          {hlsLevels.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-accent-green uppercase tracking-wider">Video Quality</label>
              <select 
                value={selectedQuality}
                onChange={e => setSelectedQuality(Number(e.target.value))}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-accent-green focus:outline-none transition-colors cursor-pointer"
              >
                <option value={-1}>Auto (Source)</option>
                {[...hlsLevels].reverse().map((level, idx) => (
                  <option key={`${level.height}-${idx}`} value={level.height}>{level.height}p</option>
                ))}
              </select>
            </div>
          )}

          {/* Audio Tracks */}
          {(audioTracks.length > 1 || availableLangs.length > 1) && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-accent-green uppercase tracking-wider">Audio Track</label>
              <select 
                value={selectedAudio}
                onChange={e => setSelectedAudio(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-accent-green focus:outline-none transition-colors cursor-pointer"
              >
                {audioTracks.length > 1 ? (
                  audioTracks.map((t, idx) => (
                    <option key={`${t.id}-${idx}`} value={t.language || t.name || t.id}>{t.language || t.name}</option>
                  ))
                ) : (
                  availableLangs.map((l, idx) => (
                    <option key={`${l}-${idx}`} value={l}>{l.toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Subtitles */}
          {subtitles.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-accent-green uppercase tracking-wider">Subtitle</label>
              <select 
                value={selectedSub}
                onChange={e => setSelectedSub(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-accent-green focus:outline-none transition-colors cursor-pointer"
              >
                <option value="none">None</option>
                {subtitles.map((s, idx) => (
                  <option key={`${s.lang}-${idx}`} value={s.lang}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Final Link */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Final Stream Link</label>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                readOnly 
                value={finalLink} 
                className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-[11px] text-white/70 font-mono focus:outline-none"
              />
              <button 
                onClick={handleCopy}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-colors cursor-pointer"
                title="Copy Link"
              >
                {copied ? <Check size={16} className="text-accent-green" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold text-white/70 hover:bg-white/10 transition-colors cursor-pointer">
            Cancel
          </button>
          <a 
            href={finalLink}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-accent-green text-black hover:bg-accent-green-hover transition-colors shadow-[0_4px_12px_rgba(0,230,118,0.3)] cursor-pointer"
          >
            Download Video
            <Download size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
