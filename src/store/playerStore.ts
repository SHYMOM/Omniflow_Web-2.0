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
}));
