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
  updateWatchlistStatus: (mediaId: string, status: string) => void;

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
    theme: 'midnight' | 'dark' | 'light';
    brandColor: string;
    incognitoMode: boolean;
  };
  subtitleSettings: {
    fontFamily: string;
    fontSize: number;
    fontColor: string;
    backgroundColor: string;
    backgroundOpacity: number;
    outlineColor: string;
    outlineWidth: number;
    position: 'bottom' | 'top';
    offsetY: number;
  };
  updateSettings: (settings: Partial<UserState['settings']>) => void;
  updateSubtitleSettings: (settings: Partial<UserState['subtitleSettings']>) => void;
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
          // default status to 'planning' if not provided
          const newItem = { ...item, status: item.status || 'planning' };
          return { watchlist: [newItem, ...state.watchlist] };
        }),
      removeFromWatchlist: (mediaId) =>
        set((state) => ({ watchlist: state.watchlist.filter((w) => w.mediaId !== mediaId) })),
      isInWatchlist: (mediaId) => get().watchlist.some((w) => w.mediaId === mediaId),
      updateWatchlistStatus: (mediaId, status) =>
        set((state) => ({
          watchlist: state.watchlist.map((w) =>
            w.mediaId === mediaId ? { ...w, status: status as any } : w
          ),
        })),

      history: [],
      addToHistory: (entry) =>
        set((state) => {
          if (state.historyPaused || state.settings.incognitoMode) return state;
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
        theme: 'midnight',
        brandColor: '#00E676',
        incognitoMode: false,
      },
      updateSettings: (newSettings) =>
        set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      subtitleSettings: {
        fontFamily: 'Inter',
        fontSize: 32,
        fontColor: '#ffffff',
        backgroundColor: '#000000',
        backgroundOpacity: 0.5,
        outlineColor: '#000000',
        outlineWidth: 2,
        position: 'bottom',
        offsetY: 20,
      },
      updateSubtitleSettings: (newSettings) =>
        set((state) => ({ subtitleSettings: { ...state.subtitleSettings, ...newSettings } })),
    }),
    {
      name: 'omnistream-user-store',
      partialize: (state) => ({
        user: state.user,
        watchlist: state.watchlist,
        history: state.history,
        historyPaused: state.historyPaused,
        settings: state.settings,
        subtitleSettings: state.subtitleSettings,
      }),
    }
  )
);
