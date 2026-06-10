import { create } from 'zustand';
import { IStreamSource, IStreamSubtitle, IAudioTrack, SkipTime } from '@/types/extraction-types';

export interface PlayerState {
  // Media context
  mediaId: string;
  mediaType: 'anime' | 'movie' | 'tv' | 'drama';
  episodeNumber?: number;
  seasonNumber?: number;
  
  // Sources (the critical broken part)
  sources: IStreamSource[];
  activeSourceIndex: number;
  isLoadingSources: boolean;
  sourceError: string | null;
  
  // Subtitles
  subtitles: IStreamSubtitle[];
  activeSubtitleLang: string | null;
  
  // Audio tracks
  audioTracks: IAudioTrack[];
  activeAudioTrack: string;
  
  // Skip times (AniSkip)
  skipTimes: SkipTime | null;
  
  // Playback
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  isMuted: boolean;
  
  // UI state
  isFullscreen: boolean;
  showControls: boolean;
  showServerSwitcher: boolean;
  showSubtitleSelector: boolean;
  showDownloadModal: boolean;

  // Setters for actions
  setMediaContext: (ctx: { mediaId: string, mediaType: 'anime' | 'movie' | 'tv' | 'drama', episodeNumber?: number, seasonNumber?: number }) => void;
  addSources: (newSources: IStreamSource[]) => void;
  playFirstSource: () => void;
  setIsLoadingSources: (loading: boolean) => void;
  setSourceError: (error: string | null) => void;
  setSubtitles: (subs: IStreamSubtitle[]) => void;
  setAudioTracks: (tracks: IAudioTrack[]) => void;
  setSkipTimes: (skipTimes: SkipTime | null) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (dur: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setVolume: (vol: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsFullscreen: (fs: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowServerSwitcher: (show: boolean) => void;
  setShowSubtitleSelector: (show: boolean) => void;
  setShowDownloadModal: (show: boolean) => void;
  
  // Actions
  loadSources: (mediaId: string, episodeId?: string) => Promise<void>;
  switchSource: (index: number) => void;
  setActiveSubtitle: (lang: string | null) => void;
  setActiveAudioTrack: (trackId: string) => void;

  // LEGACY FIELDS (to satisfy compiler while migrating)
  activeServerId: string;
  setActiveServer: (id: string) => void;
  downloadUrl: string | null;
  setDownloadUrl: (url: string | null) => void;
  availableLanguages: string[];
  setAvailableLanguages: (langs: string[]) => void;
  availableStreams: { language: string; sourceUrl: string; type: 'm3u8' | 'mp4' }[];
  setAvailableStreams: (streams: { language: string; sourceUrl: string; type: 'm3u8' | 'mp4' }[]) => void;
  externalSubtitles: { lang: string; url: string }[];
  setExternalSubtitles: (subs: { lang: string; url: string }[]) => void;
  currentStreamUrl: string | null;
  setCurrentStreamUrl: (url: string | null) => void;
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

export const usePlayerStore = create<PlayerState>((set, get) => ({
  // Default values
  mediaId: '',
  mediaType: 'anime',
  sources: [],
  activeSourceIndex: 0,
  isLoadingSources: false,
  sourceError: null,
  subtitles: [],
  activeSubtitleLang: null,
  audioTracks: [],
  activeAudioTrack: '',
  skipTimes: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  isBuffering: false,
  volume: 1,
  isMuted: false,
  isFullscreen: false,
  showControls: true,
  showServerSwitcher: false,
  showSubtitleSelector: false,
  showDownloadModal: false,

  // LEGACY
  activeServerId: 'omniflow_direct',
  setActiveServer: (id) => set({ activeServerId: id }),
  downloadUrl: null,
  setDownloadUrl: (url) => set({ downloadUrl: url }),
  availableLanguages: ['sub'],
  setAvailableLanguages: (langs) => set({ availableLanguages: langs }),
  availableStreams: [],
  setAvailableStreams: (streams) => set({ availableStreams: streams }),
  externalSubtitles: [],
  setExternalSubtitles: (subs) => set({ externalSubtitles: subs }),
  currentStreamUrl: null,
  setCurrentStreamUrl: (url) => set({ currentStreamUrl: url }),
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

  setMediaContext: (ctx) => set({ ...ctx }),
  addSources: (newSources) => set((state) => ({ sources: [...state.sources, ...newSources] })),
  playFirstSource: () => set({ activeSourceIndex: 0, isPlaying: true }),
  setIsLoadingSources: (loading) => set({ isLoadingSources: loading }),
  setSourceError: (error) => set({ sourceError: error }),
  setSubtitles: (subs) => set({ subtitles: subs }),
  setAudioTracks: (tracks) => set({ audioTracks: tracks }),
  setSkipTimes: (skipTimes) => set({ skipTimes }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (dur) => set({ duration: dur }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsBuffering: (buffering) => set({ isBuffering: buffering }),
  setVolume: (vol) => set({ volume: vol }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsFullscreen: (fs) => set({ isFullscreen: fs }),
  setShowControls: (show) => set({ showControls: show }),
  setShowServerSwitcher: (show) => set({ showServerSwitcher: show }),
  setShowSubtitleSelector: (show) => set({ showSubtitleSelector: show }),
  setShowDownloadModal: (show) => set({ showDownloadModal: show }),

  loadSources: async (mediaId: string, episodeId?: string) => {
    // Basic implementation, real logic moved to VideoPlayer via SSE
    set({ isLoadingSources: true, sourceError: null, sources: [] });
  },
  switchSource: (index: number) => set({ activeSourceIndex: index }),
  setActiveSubtitle: (lang: string | null) => set({ activeSubtitleLang: lang }),
  setActiveAudioTrack: (trackId: string) => set({ activeAudioTrack: trackId }),
}));
