import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WatchHistoryEntry, WatchlistEntry } from '@/types/media';
import { createClient } from '@/utils/supabase/client';

interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  role?: string;
  createdAt: string;
}

interface UserState {
  user: User | null;
  setUser: (user: User | null) => void;
  signIn: (identifier: string, password: string) => Promise<{success: boolean; error?: string}>;
  signUp: (email: string, username: string, password: string) => Promise<{success: boolean; error?: string; message?: string}>;
  resetPassword: (email: string) => Promise<{success: boolean; error?: string; message?: string}>;
  signOut: () => Promise<void>;

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
      setUser: (user) => set({ user }),

      signIn: async (identifier: string, password: string) => {
        try {
          const supabase = createClient();
          let email = identifier;
          
          if (!identifier.includes('@')) {
            const { data, error } = await supabase.rpc('get_email_by_username', { p_username: identifier });
            if (error || !data) {
               return { success: false, error: 'Username not found or invalid credentials.' };
            }
            email = data;
          }

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) return { success: false, error: error.message };
          if (!data.user) return { success: false, error: 'Unknown error occurred during sign in.' };

          // Fetch profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          set({
            user: {
              id: data.user.id,
              username: profile?.username || identifier,
              avatarUrl: profile?.avatar_url,
              role: profile?.role || 'user',
              createdAt: profile?.created_at || new Date().toISOString(),
            }
          });
          return { success: true };
        } catch (err: any) {
          return { success: false, error: err?.message || 'System error during sign in' };
        }
      },

      signUp: async (email: string, username: string, password: string) => {
        try {
          const supabase = createClient();
          
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                username: username,
              }
            }
          });

          if (error) return { success: false, error: error.message };
          if (!data.user) return { success: false, error: 'Unknown error occurred during sign up.' };

          if (!data.session) {
             return { success: true, message: 'Please check your email to verify your account.' };
          }

          // the trigger in schema handles profile creation, but it might take a sec or we can just set state
          set({
            user: {
              id: data.user.id,
              username: username,
              role: 'user', // newly signed up user is standard
              createdAt: new Date().toISOString(),
            }
          });
          return { success: true };
        } catch (err: any) {
           return { success: false, error: err?.message || 'System error during sign up' };
        }
      },

      resetPassword: async (email: string) => {
        const supabase = createClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
        });
        if (error) return { success: false, error: error.message };
        return { success: true, message: 'Password reset link sent to your email.' };
      },

      signOut: async () => {
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
        } catch (e) {
          console.error("SignOut error:", e);
        } finally {
          set({ user: null });
        }
      },

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
