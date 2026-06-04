import { create } from 'zustand';

interface PlayerState {
  activeServerId: string;
  setActiveServer: (id: string) => void;
  currentMediaId: string | null;
  setCurrentMediaId: (id: string | null) => void;
  currentEpisode: number;
  setCurrentEpisode: (ep: number) => void;
  currentSeason: number;
  setCurrentSeason: (s: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
  isDubbed: boolean;
  setIsDubbed: (d: boolean) => void;
  downloadUrl: string | null;
  setDownloadUrl: (url: string | null) => void;
  availableLanguages: string[];
  setAvailableLanguages: (langs: string[]) => void;
  
  // Phase 4 Dynamic State
  availableStreams: { language: string; sourceUrl: string; type: 'm3u8' | 'mp4' }[];
  setAvailableStreams: (streams: { language: string; sourceUrl: string; type: 'm3u8' | 'mp4' }[]) => void;
  externalSubtitles: { lang: string; url: string }[];
  setExternalSubtitles: (subs: { lang: string; url: string }[]) => void;
  currentLanguage: string;
  setCurrentLanguage: (lang: string) => void;
  isDownloadModalOpen: boolean;
  setIsDownloadModalOpen: (isOpen: boolean) => void;
  hotSwapToast: string | null;
  setHotSwapToast: (msg: string | null) => void;
  failedStreamUrls: Set<string>;
  addFailedStreamUrl: (url: string) => void;
  clearFailedStreamUrls: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  activeServerId: 'omniflow_direct',
  setActiveServer: (id) => set({ activeServerId: id }),
  currentMediaId: null,
  setCurrentMediaId: (id) => set({ currentMediaId: id }),
  currentEpisode: 1,
  setCurrentEpisode: (ep) => set({ currentEpisode: ep }),
  currentSeason: 1,
  setCurrentSeason: (s) => set({ currentSeason: s }),
  isPlaying: false,
  setIsPlaying: (p) => set({ isPlaying: p }),
  isMuted: true,
  setIsMuted: (m) => set({ isMuted: m }),
  isDubbed: false,
  setIsDubbed: (d) => set({ isDubbed: d }),
  downloadUrl: null,
  setDownloadUrl: (url) => set({ downloadUrl: url }),
  availableLanguages: ['sub'],
  setAvailableLanguages: (langs) => set({ availableLanguages: langs }),
  
  availableStreams: [],
  setAvailableStreams: (streams) => set({ availableStreams: streams }),
  externalSubtitles: [],
  setExternalSubtitles: (subs) => set({ externalSubtitles: subs }),
  currentLanguage: 'sub',
  setCurrentLanguage: (lang) => set({ currentLanguage: lang }),
  isDownloadModalOpen: false,
  setIsDownloadModalOpen: (isOpen) => set({ isDownloadModalOpen: isOpen }),
  hotSwapToast: null,
  setHotSwapToast: (msg) => set({ hotSwapToast: msg }),
  failedStreamUrls: new Set<string>(),
  addFailedStreamUrl: (url) => set((state) => {
    const updated = new Set(state.failedStreamUrls);
    updated.add(url);
    return { failedStreamUrls: updated };
  }),
  clearFailedStreamUrls: () => set({ failedStreamUrls: new Set<string>() }),
}));
