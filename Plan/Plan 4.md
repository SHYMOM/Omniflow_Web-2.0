# OmniStream — Detailed Implementation Plan (Part 4 of 4)

## 16. Watchlist & Profile Pages

### 16.1 Watchlist Page (`src/app/watchlist/page.tsx`)
**Layout:** Full-width grid of saved media items

```
My List
[Sort: Recently Added ▾]  [Filter: All ▾]

[MediaCard] [MediaCard] [MediaCard] [MediaCard] [MediaCard] [MediaCard]
[MediaCard] [MediaCard] [MediaCard] [MediaCard] [MediaCard] [MediaCard]
```

- Grid: 6 cols desktop, 4 tablet, 2 mobile
- Each card has a remove button (X) on hover, absolute top-right
- Empty state: illustration + "Your watchlist is empty. Start adding shows!"
- Data: `userStore.watchlist[]` from localStorage via zustand persist

### 16.2 Profile Page (`src/app/profile/page.tsx`)
```
┌─────────────────────────────────────┐
│ [Avatar 80px]  Username             │
│                Member since May 2026│
│                                     │
│ [Edit Profile] [Sign Out]           │
├─────────────────────────────────────┤
│ Stats                               │
│ 📺 12 Watching  ✅ 45 Completed     │
│ 📋 23 In List   🕐 156h Watched     │
├─────────────────────────────────────┤
│ Settings                            │
│ ☐ Auto-play next episode            │
│ ☐ Default to dub                    │
│ Theme: [Dark ▾]                     │
│ Default player: [VidSrc ICU ▾]      │
└─────────────────────────────────────┘
```

---

## 17. Loading & Error States

### 17.1 Loading States
Every route gets a `loading.tsx` with skeleton matching page layout:

**Home loading:** Hero skeleton (full-width shimmer) + row of card skeletons
**Detail loading:** Banner shimmer + poster shimmer + text line skeletons
**Search loading:** Grid of card skeletons
**Watch loading:** Video player area shimmer + sidebar skeletons

**Skeleton card component (`SkeletonCard.tsx`):**
```
┌──────────────────┐
│ ░░░░░░░░░░░░░░░░ │  ← shimmer gradient animation
│ ░░░░░░░░░░░░░░░░ │     bg-gradient-to-r from-surface via-surface-hover to-surface
│ ░░░░░░░░░░░░░░░░ │     background-size: 200% 100%
│ ░░░░░░░░░░░░░░░░ │     animation: shimmer 2s infinite
└──────────────────┘
  ░░░░░░   ░░░░       ← text line skeletons
  ░░░░░░░░░░░░░░      ← title skeleton
```

### 17.2 Error States
Every route gets an `error.tsx`:
```tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="bg-surface rounded-2xl p-8 border border-border text-center max-w-md">
        <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-secondary text-sm mb-6">{error.message}</p>
        <button onClick={reset} className="bg-accent-green text-black font-semibold px-6 py-2.5 rounded-lg">
          Try Again
        </button>
      </div>
    </div>
  );
}
```

---

## 18. Complete File Inventory

### Config Files (4 files)
```
.env                          — Environment variables (modified)
next.config.ts                — Image domains, redirects
tailwind.config.ts            — Design tokens, custom utilities
tsconfig.json                 — Auto-generated, minor path tweaks
```

### Public Assets (2 files)
```
public/servers.json           — Video embed server definitions
public/favicon.ico            — OMNISTREAM favicon
```

### Type Definitions (5 files)
```
src/types/media.ts            — MediaItem, WatchHistoryEntry, WatchlistEntry
src/types/tmdb.ts             — TMDBMovie, TMDBTVShow, TMDBSeason, TMDBEpisode, TMDBCredits
src/types/anilist.ts          — AniListMedia, AniListCharacter, AniListStaff, AniListRelation
src/types/jikan.ts            — JikanAnime, JikanEpisode, JikanSchedule
src/types/server.ts           — Server, ServerPattern
```

### API Routes — Server-Side Proxy (14 files)
```
src/app/api/tmdb/trending/route.ts
src/app/api/tmdb/search/route.ts
src/app/api/tmdb/movie/[id]/route.ts
src/app/api/tmdb/movie/[id]/videos/route.ts
src/app/api/tmdb/tv/[id]/route.ts
src/app/api/tmdb/tv/[id]/season/[s]/route.ts
src/app/api/anilist/route.ts                    — GraphQL proxy
src/app/api/jikan/top/route.ts
src/app/api/jikan/anime/[id]/route.ts
src/app/api/jikan/anime/[id]/episodes/route.ts
src/app/api/jikan/anime/[id]/characters/route.ts
src/app/api/jikan/anime/[id]/staff/route.ts
src/app/api/jikan/schedules/route.ts
src/app/api/mangaupdates/search/route.ts
```

### API Client Functions (4 files)
```
src/lib/api/tmdb.ts           — TMDB client functions
src/lib/api/anilist.ts        — AniList GraphQL client
src/lib/api/jikan.ts          — Jikan client with rate limiting
src/lib/api/mangaupdates.ts   — MangaUpdates client
```

### Utilities (4 files)
```
src/lib/utils/cn.ts           — clsx + tailwind-merge
src/lib/utils/formatters.ts   — Date, score, duration, view count formatters
src/lib/utils/serverBuilder.ts — Build embed URLs from servers.json
src/lib/queryClient.ts        — React Query client config
```

### Hooks (4 files)
```
src/lib/hooks/useDebounce.ts
src/lib/hooks/useMediaQuery.ts
src/lib/hooks/useLocalStorage.ts
src/lib/hooks/useIntersectionObserver.ts
```

### Stores (3 files)
```
src/store/uiStore.ts
src/store/playerStore.ts
src/store/userStore.ts
```

### Layout Components (4 files)
```
src/components/layout/Sidebar.tsx
src/components/layout/Topbar.tsx
src/components/layout/MobileNav.tsx
src/app/layout.tsx
```

### UI Components (6 files)
```
src/components/ui/ImageWithFallback.tsx
src/components/ui/Toast.tsx
src/components/ui/Modal.tsx
src/components/ui/Tabs.tsx
src/components/ui/Slider.tsx
src/components/ui/LoadingSpinner.tsx
```

### Media Components (6 files)
```
src/components/media/MediaCard.tsx
src/components/media/HoverCard.tsx
src/components/media/MediaGrid.tsx
src/components/media/MediaRow.tsx
src/components/media/SkeletonCard.tsx
src/components/media/TypeBadge.tsx
```

### Home Page Components (7 files)
```
src/app/page.tsx
src/components/home/HeroBanner.tsx
src/components/home/ContinueWatching.tsx
src/components/home/TrendingRow.tsx
src/components/home/TabbedGrid.tsx
src/components/home/RecentComments.tsx
src/components/home/ScheduleWidget.tsx
src/components/home/TopUpcoming.tsx
src/components/home/RecentlyUpdated.tsx
```

### Search Components (4 files)
```
src/app/search/page.tsx
src/components/search/SearchBar.tsx
src/components/search/SearchModal.tsx
src/components/search/FilterSidebar.tsx
```

### Detail Page Components (8 files)
```
src/app/anime/[id]/page.tsx
src/app/movie/[id]/page.tsx
src/app/tv/[id]/page.tsx
src/app/manga/[id]/page.tsx
src/components/details/DetailHeader.tsx
src/components/details/OverviewTab.tsx
src/components/details/EpisodesTab.tsx
src/components/details/RelatedTab.tsx
src/components/details/MoreLikeThisTab.tsx
```

### Player Components (4 files)
```
src/app/watch/page.tsx
src/components/player/VideoPlayer.tsx
src/components/player/ServerSwitcher.tsx
src/components/player/EpisodeSidebar.tsx
```

### Manga Components (2 files)
```
src/app/read/[id]/[chapter]/page.tsx
src/components/manga/MangaReader.tsx
```

### Auth & Profile (4 files)
```
src/components/auth/AuthModal.tsx
src/app/profile/page.tsx
src/app/watchlist/page.tsx
src/app/history/page.tsx
```

### Loading & Error States (~20 files)
```
src/app/loading.tsx
src/app/error.tsx
src/app/anime/[id]/loading.tsx
src/app/anime/[id]/error.tsx
src/app/movie/[id]/loading.tsx
src/app/movie/[id]/error.tsx
src/app/tv/[id]/loading.tsx
src/app/tv/[id]/error.tsx
src/app/manga/[id]/loading.tsx
src/app/manga/[id]/error.tsx
src/app/search/loading.tsx
src/app/search/error.tsx
src/app/watch/loading.tsx
src/app/watch/error.tsx
src/app/history/loading.tsx
src/app/watchlist/loading.tsx
src/app/profile/loading.tsx
src/app/read/[id]/[chapter]/loading.tsx
src/app/not-found.tsx
```

**Total: ~99 files**

---

## 19. Execution Order (10 Batches)

| Batch | Description | Files | Dependencies |
|-------|-------------|-------|--------------|
| 1 | Project init, install deps, config files | 5 | None |
| 2 | Design system: tailwind config, globals.css, fonts | 3 | Batch 1 |
| 3 | Type definitions | 5 | Batch 1 |
| 4 | API route proxies + client functions | 18 | Batch 3 |
| 5 | Utilities, hooks, stores, React Query | 11 | Batch 3 |
| 6 | Layout: Sidebar, Topbar, MobileNav, root layout | 4 | Batch 2, 5 |
| 7 | Shared UI + Media components | 12 | Batch 6 |
| 8 | Home page + all sections | 9 | Batch 7 |
| 9 | Detail pages, Search, Watch, Read, Auth, Profile, History | 20 | Batch 7, 8 |
| 10 | Loading/error states, polish, verification | 20 | Batch 9 |

---

## 20. Verification Plan

### 20.1 Build Verification
```bash
npx tsc --noEmit          # Type checking
npx next lint             # Linting  
npm run build             # Full production build (catches SSR errors)
npm run dev               # Dev server smoke test
```

### 20.2 Browser Testing Checklist
- [ ] Home page loads with trending data from AniList
- [ ] Hero banner cycles through trending anime with trailer backgrounds
- [ ] MediaCard hover shows HoverCard with trailer after 400ms
- [ ] Sidebar toggles open/close with animation
- [ ] Bottom nav appears on mobile only
- [ ] Search modal opens with Ctrl+K, returns debounced results
- [ ] Anime detail page loads all tabs (Overview, Episodes, Characters, Related, More Like This)
- [ ] Episode grid shows pagination and view switching
- [ ] Video player loads embed from selected server
- [ ] Server switcher changes embed URL
- [ ] Sign-in modal works with localStorage persistence
- [ ] Watch history records and displays entries
- [ ] Watchlist add/remove works across pages
- [ ] Schedule widget shows daily anime schedule
- [ ] Responsive at 375px (mobile), 768px (tablet), 1280px (desktop)
- [ ] No console errors in browser DevTools
- [ ] Dark theme consistent across all pages
- [ ] All animations smooth (60fps)

### 20.3 API Integration Verification
- [ ] AniList GraphQL returns trending anime
- [ ] AniList returns full anime details with characters, staff, relations
- [ ] Jikan returns episode data and schedule
- [ ] TMDB returns movie/TV details
- [ ] MangaUpdates returns manga metadata
- [ ] Rate limiting doesn't cause errors (test rapid navigation)
- [ ] React Query caching works (check network tab for deduplication)

---

## 21. Key Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API key exposure | Server-side proxy via API routes | Keeps TMDB key secure |
| Primary anime API | AniList GraphQL | Richer data than Jikan (tags, relations, characters with VA, nextAiringEpisode) |
| Jikan usage | Fallback + episode images + schedule | Jikan has episode video thumbnails and schedule endpoint |
| Manga data | AniList + MangaUpdates | AniList for core metadata, MangaUpdates for publishers/categories |
| State management | Zustand + persist | Lightweight, no boilerplate, localStorage persistence built-in |
| Data fetching | React Query | Caching, deduplication, stale-while-revalidate, error boundaries |
| Animations | Framer Motion | Production-quality spring animations for sidebar, hover cards, page transitions |
| Styling | Tailwind CSS | Design token system, rapid iteration, consistent spacing |
| Video embeds | iframe + sandbox | Anti-redirect protection, no allow-top-navigation |
| Comments system | localStorage | No backend needed, user's own comments persist locally |
| Auth | localStorage | Client-side only, no real backend auth |
