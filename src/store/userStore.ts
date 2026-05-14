import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchHistoryEntry, WatchlistEntry } from '@/types/media';

interface User {
  username: string;
  avatarUrl?: string;
  createdAt: string;
}

interface UserState {
  user: User | null;
  signIn: (username: string, password: string) => boolean;
  signUp: (username: string, password: string) => boolean;
  signOut: () => void;

  watchlist: WatchlistEntry[];
  addToWatchlist: (item: WatchlistEntry) => void;
  removeFromWatchlist: (mediaId: string) => void;
  isInWatchlist: (mediaId: string) => boolean;

  history: WatchHistoryEntry[];
  addToHistory: (entry: WatchHistoryEntry) => void;
  removeFromHistory: (mediaId: string, episodeNumber?: number) => void;
  clearHistory: () => void;
  importHistory: (entries: WatchHistoryEntry[]) => void;
  historyPaused: boolean;
  toggleHistoryPause: () => void;

  settings: {
    autoPlayNext: boolean;
    defaultToDub: boolean;
    autoPlayTrailer: boolean;
    hideAdult: boolean;
  };
  updateSettings: (settings: Partial<UserState['settings']>) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,

      signIn: (username: string, _password: string) => {
        // Client-side only auth — passwords stored in localStorage (demo only)
        const users = JSON.parse(localStorage.getItem('omnistream_users') || '{}');
        if (users[username]) {
          set({ user: { username, createdAt: users[username].createdAt } });
          return true;
        }
        return false;
      },

      signUp: (username: string, _password: string) => {
        const users = JSON.parse(localStorage.getItem('omnistream_users') || '{}');
        if (users[username]) return false;
        const createdAt = new Date().toISOString();
        users[username] = { createdAt };
        localStorage.setItem('omnistream_users', JSON.stringify(users));
        set({ user: { username, createdAt } });
        return true;
      },

      signOut: () => set({ user: null }),

      watchlist: [],
      addToWatchlist: (item) =>
        set((state) => {
          if (state.watchlist.some((w) => w.mediaId === item.mediaId)) return state;
          return { watchlist: [item, ...state.watchlist] };
        }),
      removeFromWatchlist: (mediaId) =>
        set((state) => ({ watchlist: state.watchlist.filter((w) => w.mediaId !== mediaId) })),
      isInWatchlist: (mediaId) => get().watchlist.some((w) => w.mediaId === mediaId),

      history: [],
      addToHistory: (entry) =>
        set((state) => {
          if (state.historyPaused) return state;
          // Robust deduplication: Remove any existing entry for this media ID entirely
          // to ensure only the latest episode for a series is shown in 'Jump Back In'.
          const filtered = state.history.filter((h) => h.mediaId !== entry.mediaId);
          return { history: [entry, ...filtered].slice(0, 100) }; 
        }),
      removeFromHistory: (mediaId, episodeNumber) =>
        set((state) => ({
          history: state.history.filter(
            (h) => !(h.mediaId === mediaId && (episodeNumber == null || h.episodeNumber === episodeNumber))
          ),
        })),
      clearHistory: () => set({ history: [] }),
      importHistory: (entries) =>
        set((state) => {
          const merged = [...entries, ...state.history];
          const uniqueMap = new Map();
          for (const item of merged) {
            const key = `${item.mediaId}-${item.episodeNumber}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, item);
          }
          return { history: Array.from(uniqueMap.values()).slice(0, 500) };
        }),
      historyPaused: false,
      toggleHistoryPause: () => set((state) => ({ historyPaused: !state.historyPaused })),

      settings: {
        autoPlayNext: true,
        defaultToDub: false,
        defaultServerId: 'vidsrc-icu',
        autoPlayTrailer: true,
        hideAdult: true,
      },
      updateSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
    }),
    {
      name: 'omnistream-user-store',
      partialize: (state) => ({
        user: state.user,
        watchlist: state.watchlist,
        history: state.history,
        historyPaused: state.historyPaused,
        settings: state.settings,
      }),
    }
  )
);
