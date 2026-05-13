# OmniStream — Detailed Implementation Plan (Part 3 of 4)

## 9. Sign-In Modal

### 9.1 Auth Modal (`src/components/auth/AuthModal.tsx`)
**Screenshot reference:** "Sign In Pop Up 1.png" + "Sign In Pop Up 2.png"

**Key observation:** The screenshots show two variants with different anime character images on the left. This is a split-panel modal.

**Modal container:** Centered, `max-w-[800px] w-[90vw]`, `bg-void rounded-2xl overflow-hidden`, `border border-border`

**Layout — 2 columns:**
```
┌──────────────────────┬─────────────────────────────┐
│                      │                             │
│  [Anime character    │   Welcome back              │
│   artwork image]     │   Sign in to your OMNISTREAM│
│                      │   account                   │
│  Full-height         │                             │
│  object-cover        │   Username                  │
│  rounded-l-2xl       │   [________________]        │
│                      │                             │
│                      │   Password                  │
│                      │   [________________] [👁]   │
│                      │                             │
│                      │   [    Sign in     ]        │
│                      │                             │
│                      │   Don't have an account?    │
│                      │   Sign up                   │
│                      │                             │
└──────────────────────┴─────────────────────────────┘
```

**Left panel (50% width):**
- Random anime artwork image. We'll use a curated set of 5-8 images stored in `/public/auth/`
- Generated using the image generation tool during build
- `object-cover h-full rounded-l-2xl`

**Right panel (50% width, padding 40px):**
- "Welcome back" → `text-[28px] font-bold text-white text-center`
- "Sign in to your OMNISTREAM account" → `text-[14px] text-secondary text-center mb-8`
- Input labels → `text-[14px] font-semibold text-white mb-2`
- Input fields → `bg-surface border-none rounded-lg px-4 py-3 text-white text-[14px] w-full focus:ring-2 focus:ring-accent-green`
- Password eye toggle → `absolute right-3 top-1/2 -translate-y-1/2 text-secondary cursor-pointer`
- Sign in button → `bg-white text-black font-semibold text-[16px] py-3 w-full rounded-lg hover:bg-gray-200 mt-6`
- "Don't have an account? **Sign up**" → `text-secondary text-[14px] text-center mt-6`, "Sign up" = `text-white font-semibold cursor-pointer underline`

**Auth is client-side only (localStorage):**
```ts
// src/lib/storage/auth.ts
interface User { username: string; avatarUrl?: string; createdAt: string; }
const AUTH_KEY = 'omnistream_user';
function signIn(username: string, password: string): User { /* localStorage */ }
function signUp(username: string, password: string): User { /* localStorage */ }
function signOut(): void { localStorage.removeItem(AUTH_KEY); }
function getCurrentUser(): User | null { /* parse localStorage */ }
```

---

## 10. Watch History Page

### 10.1 History Page (`src/app/history/page.tsx`)
**Screenshot reference:** "Watch History Page.png"

**Layout — 2 column:**
```
┌──────────────────────────────────────────┬───────────────────────┐
│                                          │                       │
│  Watch History                           │ [🔍 Search history]   │
│                                          │                       │
│  May 7, 2026                             │ ⏸ Pause watch history │
│  ┌────────────────────────────────────┐  │                       │
│  │ [thumb 180×100] To You Two Thousand│  │ 🗑 Clear watch history│
│  │ [progress bar]   Years Later       │  │    (text-accent-red)  │
│  │ [24:43]         Attack on Titan  ⋮ │  │                       │
│  ├────────────────────────────────────┤  │                       │
│  │ [thumb 180×100] Departure × And ×  │  │                       │
│  │ [progress bar]   Friends           │  │                       │
│  │ [23:36]         HxH (2011)       ⋮ │  │                       │
│  └────────────────────────────────────┘  │                       │
└──────────────────────────────────────────┴───────────────────────┘
```

**History entry card:**
- Thumbnail: `180×100px rounded-lg`, with green progress bar at bottom and duration badge
- Episode title: `text-white text-[16px] font-medium`
- Show name: `text-secondary text-[14px]`
- Three-dot menu (⋮): `text-secondary hover:text-white`, dropdown with "Remove from history"
- Cards have `bg-surface/50 hover:bg-surface rounded-lg p-2` background

**Right sidebar:**
- Search: `bg-surface border border-border rounded-lg px-4 py-2.5 text-[14px]` + search icon
- "Pause watch history": `text-white text-[14px]` with pause icon, toggles history recording
- "Clear watch history": `text-accent-red text-[14px]` with trash icon, shows confirmation modal

**Date grouping:** Group entries by date (today, yesterday, specific dates). Each group has date header: `text-white text-[18px] font-semibold mb-4`

**Data source:** `localStorage` key `omnistream_history`
```ts
interface WatchHistoryEntry {
  mediaId: string;
  mediaType: 'anime' | 'movie' | 'tv';
  mediaTitle: string;
  episodeTitle: string;
  episodeNumber: number;
  season?: number;
  thumbnailUrl: string;
  posterUrl: string;
  duration: number;      // seconds
  watchedAt: string;     // ISO timestamp
  progress: number;      // 0-1 (percentage watched)
}
```

---

## 11. Search & Browse Page

### 11.1 Search Modal (quick search from Topbar)
**Trigger:** Click search bar or Ctrl+K
**Behavior:** Debounced (300ms), queries AniList + TMDB in parallel

**Quick results dropdown (max 5 results):**
```
┌──────────────────────────────────────┐
│ [poster 40×56] One Piece             │
│                TV Show • 1999 • 8.7  │
├──────────────────────────────────────┤
│ [poster 40×56] One Piece Film: Red   │
│                Movie • 2022 • 7.1    │
├──────────────────────────────────────┤
│ View all results for "one piece" →   │
└──────────────────────────────────────┘
```

### 11.2 Search Page (`src/app/search/page.tsx`)
**URL:** `/search?q=one+piece&type=anime&genre=Action&year=2026&sort=popularity`

**Layout — sidebar filters + results grid:**
```
┌─── Filter Sidebar (240px) ────┬─── Results ─────────────────────┐
│                                │                                 │
│ Type                           │ Showing 45 results for "..."    │
│ ○ All  ○ Anime  ○ Movie       │                                 │
│ ○ TV   ○ Manga               │ [Card] [Card] [Card] [Card]     │
│                                │ [Card] [Card] [Card] [Card]     │
│ Year                           │ [Card] [Card] [Card] [Card]     │
│ [2020 ▾] to [2026 ▾]         │                                 │
│                                │ [Load More]                     │
│ Score                          │                                 │
│ [──────●──] 7.0+              │                                 │
│                                │                                 │
│ Genres                         │                                 │
│ ☑ Action  ☑ Adventure         │                                 │
│ ☐ Comedy  ☐ Drama             │                                 │
│ ☐ Fantasy ☐ Horror            │                                 │
│                                │                                 │
│ Status                         │                                 │
│ ○ All ○ Airing ○ Finished    │                                 │
│                                │                                 │
│ Sort by                        │                                 │
│ [Popularity ▾]                │                                 │
└────────────────────────────────┴─────────────────────────────────┘
```

**Filter sidebar on mobile:** Collapses into a "Filters" button that opens a bottom sheet

**Search query routing:**
- Type "anime" → AniList GraphQL with filters
- Type "movie"/"tv" → TMDB `/search/movie` or `/search/tv`
- Type "manga" → AniList GraphQL (type: MANGA) + MangaUpdates fallback
- Type "all" → parallel queries to all sources, merge & deduplicate

---

## 12. Manga Pages

### 12.1 Manga Detail (`src/app/manga/[id]/page.tsx`)
Same layout as anime detail page but with manga-specific fields:
- Chapters instead of Episodes tab
- No trailer section
- Additional fields: Volumes, Serialization

**Data source:** AniList (type: MANGA) + MangaUpdates for extra metadata

### 12.2 Manga Reader (`src/app/read/[id]/[chapter]/page.tsx`)
**Two reading modes:**

**Webtoon Mode (default for long-strip manga):**
- Infinite vertical scroll
- Images loaded lazily with IntersectionObserver
- Auto-scroll control: speed slider (1-10), play/pause
- Chapter auto-advance: when reaching bottom, prompt "Next Chapter?"

**Traditional Mode (paginated):**
- Single page or double-page spread
- Keyboard navigation: ← → arrow keys, or click left/right side of image
- Page indicator: "Page 5 / 23"
- Spread detection: if image width > 1.4× height, treat as spread

**Chapter data:** Since we're not using MangaDex, chapters will be sourced from embed servers:
- `/read` URL pattern from servers.json: `https://vidsrc.icu/embed/manga/{malId}/{chapter}`

---

## 13. State Management

### 13.1 UI Store (`src/store/uiStore.ts`)
```ts
interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
}
```

### 13.2 Player Store (`src/store/playerStore.ts`)
```ts
interface PlayerState {
  activeServerId: string;
  setActiveServer: (id: string) => void;
  currentMediaId: string | null;
  currentEpisode: number;
  currentSeason: number;
  setCurrentEpisode: (ep: number) => void;
  setCurrentSeason: (s: number) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
}
```

### 13.3 User Store (`src/store/userStore.ts`)
```ts
// With zustand persist middleware (localStorage)
interface UserState {
  user: User | null;
  signIn: (username: string, password: string) => void;
  signUp: (username: string, password: string) => void;
  signOut: () => void;
  watchlist: WatchlistEntry[];
  addToWatchlist: (item: MediaItem) => void;
  removeFromWatchlist: (id: string) => void;
  isInWatchlist: (id: string) => boolean;
  history: WatchHistoryEntry[];
  addToHistory: (entry: WatchHistoryEntry) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  historyPaused: boolean;
  toggleHistoryPause: () => void;
}
```

---

## 14. Custom Hooks

```ts
// useDebounce.ts — debounce search input
function useDebounce<T>(value: T, delay: number): T

// useMediaQuery.ts — responsive breakpoints
function useMediaQuery(query: string): boolean

// useLocalStorage.ts — typed localStorage with SSR safety
function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void]

// useIntersectionObserver.ts — lazy loading & infinite scroll
function useIntersectionObserver(ref: RefObject, options?: IntersectionObserverInit): boolean
```

---

## 15. React Query Configuration

```ts
// src/lib/queryClient.ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 minutes
      gcTime: 30 * 60 * 1000,       // 30 minutes cache
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

**Query key conventions:**
```ts
['trending', type]              // trending content
['anime', id]                   // anime details
['anime', id, 'episodes', page] // anime episodes
['movie', id]                   // movie details
['tv', id]                      // tv details
['search', query, filters]      // search results
['schedule', day]               // daily schedule
['upcoming']                    // upcoming anime
```

---

*Continued in Part 4: File inventory, loading/error states, verification plan*
