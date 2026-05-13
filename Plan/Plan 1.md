# OmniStream — Detailed Implementation Plan (Part 1 of 4)

## 1. Project Overview & Scaffold

**Brand:** OMNISTREAM (not Omniflow)
**Stack:** Next.js 14+ App Router, TypeScript, Tailwind CSS
**API Strategy:** All API calls proxied through Next.js API routes (no NEXT_PUBLIC_ API keys)

### 1.1 Project Init Commands
```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
npm install framer-motion zustand @tanstack/react-query axios lucide-react clsx tailwind-merge react-hot-toast swiper react-youtube
npm install -D @types/node
```

### 1.2 Environment Variables (.env)
```env
# Server-side only (proxied via /api/ routes)
TMDB_API_KEY=fb7bb23f03b6994dafc674c074d01761
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p
JIKAN_BASE_URL=https://api.jikan.moe/v4
ANILIST_BASE_URL=https://graphql.anilist.co
MANGAUPDATES_BASE_URL=https://api.mangaupdates.com/v1

# Public (safe to expose)
NEXT_PUBLIC_APP_NAME=OMNISTREAM
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 1.3 next.config.ts — Image Domains
```ts
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'image.tmdb.org' },        // TMDB posters/backdrops
    { protocol: 'https', hostname: 'cdn.myanimelist.net' },    // Jikan/MAL images
    { protocol: 'https', hostname: 's4.anilist.co' },          // AniList images
    { protocol: 'https', hostname: 'img.youtube.com' },        // YouTube thumbnails
    { protocol: 'https', hostname: 'cdn.mangaupdates.com' },   // MangaUpdates covers
  ]
}
```

---

## 2. Design System (from Screenshot Analysis)

### 2.1 Color Palette (extracted from Animetsu screenshots)
| Token | Hex | Usage |
|-------|-----|-------|
| `void` | `#0a0a0a` | Page background (pure dark, near-black) |
| `surface` | `#141414` | Card backgrounds, sidebar bg |
| `surface-hover` | `#1a1a1a` | Hover states on cards |
| `surface-elevated` | `#1e1e1e` | Modals, dropdowns, popovers |
| `border` | `#2a2a2a` | Subtle borders on cards/dividers |
| `text-primary` | `#ffffff` | Headings, titles |
| `text-secondary` | `#a0a0a0` | Subtitles, metadata |
| `text-muted` | `#666666` | Timestamps, view counts |
| `accent-green` | `#4ade80` | Primary accent (status dots, active states, "AIRING" badge) |
| `accent-red` | `#ef4444` | Destructive actions, "Clear watch history" |
| `accent-gold` | `#facc15` | Star ratings badge |
| `badge-type` | `#333333` | "TV Show", "ONA", "MOVIE" badge bg |

### 2.2 Typography
| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Logo "OMNISTREAM" | Orbitron | 20px | 700 | white |
| Section titles ("Trending Now") | Inter | 20px | 600 | white |
| Card title | Inter | 13px | 500 | white |
| Card metadata ("TV Show  2026") | Inter | 11px | 400 | text-secondary |
| Rating badge | Inter | 12px | 700 | white (on gold bg) |
| Episode title | Inter | 14px | 500 | white |
| Tab labels | Inter | 14px | 500 | text-secondary (white when active) |
| Body/description text | Inter | 14px | 400 | text-secondary |
| HoverCard title | Inter | 18px | 600 | white |
| Detail page title | Inter | 24px | 700 | white |

### 2.3 Tailwind Config Additions
```ts
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      void: '#0a0a0a',
      surface: { DEFAULT: '#141414', hover: '#1a1a1a', elevated: '#1e1e1e' },
      border: '#2a2a2a',
      accent: { green: '#4ade80', red: '#ef4444', gold: '#facc15' },
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      display: ['Orbitron', 'sans-serif'],
    },
    animation: {
      'shimmer': 'shimmer 2s infinite linear',
      'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
    },
  }
}
```

### 2.4 Global CSS (globals.css)
```css
/* Dark scrollbar */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: #4ade80; border-radius: 4px; }

/* Shimmer skeleton animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Body defaults */
body { background: #0a0a0a; color: #fff; }
```

---

## 3. Hybrid API Architecture

### 3.1 API Route Proxy System
All external API calls go through Next.js API routes at `/api/tmdb/...`, `/api/anilist/...`, `/api/jikan/...`, `/api/mangaupdates/...`. This keeps API keys server-side.

**Route structure:**
```
src/app/api/
├── tmdb/
│   ├── trending/route.ts        → GET /api/tmdb/trending?type=movie|tv&timeWindow=week
│   ├── search/route.ts          → GET /api/tmdb/search?q=...&page=1
│   ├── movie/[id]/route.ts      → GET /api/tmdb/movie/927085
│   ├── tv/[id]/route.ts         → GET /api/tmdb/tv/158876
│   ├── tv/[id]/season/[s]/route.ts → GET /api/tmdb/tv/158876/season/1
│   └── movie/[id]/videos/route.ts  → GET /api/tmdb/movie/927085/videos
├── anilist/
│   └── route.ts                 → POST /api/anilist (GraphQL proxy)
├── jikan/
│   ├── top/route.ts             → GET /api/jikan/top?type=anime&filter=airing
│   ├── anime/[id]/route.ts      → GET /api/jikan/anime/21
│   ├── anime/[id]/episodes/route.ts
│   ├── anime/[id]/characters/route.ts
│   ├── anime/[id]/staff/route.ts
│   ├── anime/[id]/relations/route.ts
│   ├── anime/[id]/recommendations/route.ts
│   ├── schedules/route.ts       → GET /api/jikan/schedules?day=monday
│   └── search/route.ts          → GET /api/jikan/search?q=...&type=anime
└── mangaupdates/
    ├── search/route.ts          → POST /api/mangaupdates/search
    └── series/[id]/route.ts     → GET /api/mangaupdates/series/12345
```

### 3.2 Data Flow Per Content Type

**For Anime (primary: AniList, fallback: Jikan):**
```
Client Request → /api/anilist (GraphQL query)
  → Returns: title, description, coverImage, bannerImage, trailer.id (YouTube),
     score, episodes, duration, status, season, genres, tags,
     studios, characters (with voice actors), staff, relations, recommendations,
     nextAiringEpisode { airingAt, episode }
  → Fallback to /api/jikan/* for: background, openings/endings, more episodes detail
```

**AniList GraphQL query for anime detail:**
```graphql
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { romaji english native }
    description(asHtml: false)
    coverImage { extraLarge large }
    bannerImage
    trailer { id site }
    format status season seasonYear episodes duration
    averageScore meanScore
    genres tags { name rank }
    studios(isMain: true) { nodes { name } }
    characters(sort: ROLE, perPage: 12) {
      edges { role node { name { full } image { large } }
        voiceActors(language: JAPANESE) { name { full } image { large } } }
    }
    staff(perPage: 8) { edges { role node { name { full } image { large } } } }
    relations { edges { relationType node { id title { romaji } coverImage { large } format seasonYear } } }
    recommendations(perPage: 15) { nodes { mediaRecommendation { id title { romaji } coverImage { large } format seasonYear } } }
    nextAiringEpisode { airingAt episode }
    source countryOfOrigin synonyms hashtag startDate { year month day } endDate { year month day }
  }
}
```

**For Movies/TV (TMDB only):**
```
Client → /api/tmdb/movie/[id] or /api/tmdb/tv/[id]
  → TMDB append_to_response=credits,videos,similar,recommendations
  → Returns: title, overview, poster_path, backdrop_path, vote_average,
     runtime, release_date, genres, cast, crew, trailer key, similar, recommendations
```

**For Manga (MangaUpdates + AniList):**
```
Client → /api/anilist (type: MANGA) for: coverImage, description, score, genres, tags, characters, relations
       → /api/mangaupdates/series/[id] for: categories, publishers, groups, latest releases
```

### 3.3 Rate Limiting Strategy
| API | Limit | Strategy |
|-----|-------|----------|
| TMDB | ~40 req/s | No special handling needed |
| AniList | 90 req/min | React Query `staleTime: 5min`, `cacheTime: 30min` |
| Jikan | 3 req/s, 60 req/min | 400ms delay between calls, used as fallback only |
| MangaUpdates | Reasonable spacing | 500ms delay, cache aggressively |

### 3.4 Unified MediaItem Interface
```ts
interface MediaItem {
  id: string;                    // Format: "anilist-21" / "tmdb-movie-927085" / "mu-12345"
  source: 'anilist' | 'tmdb' | 'mangaupdates';
  type: 'anime' | 'movie' | 'tv' | 'manga';
  title: string;                 // English preferred, fallback romaji
  nativeTitle?: string;
  posterUrl: string;             // Resolved full URL
  bannerUrl?: string;
  description: string;
  score: number;                 // Normalized 0-10 scale
  year: number;
  status: string;                // "AIRING" | "FINISHED" | "RELEASING" etc
  format: string;                // "TV Show" | "ONA" | "MOVIE" | "MANGA"
  genres: string[];
  episodeCount?: number;
  duration?: string;             // "24 min"
  season?: string;               // "FALL 1999"
  trailerYoutubeId?: string;
  malId?: number;                // For embed URL building
  tmdbId?: number;               // For embed URL building
  anilistId?: number;
}
```

---

## 4. Layout Components (from Screenshots)

### 4.1 Topbar (`src/components/layout/Topbar.tsx`)
**Screenshot reference:** Top of HomePage Part 1 — "Side bar" arrow, "Software Logo" arrow, "Search" arrow

**Layout (56px height, fixed top, full-width, bg-void, z-50):**
```
[≡ Hamburger] [OMNISTREAM logo (Orbitron font, white)] ---- [Search... input] [🔔 Bell] [→ Sign In btn]
```

**Details:**
- **Hamburger (left):** 3-line icon, toggles sidebar collapse via `uiStore.toggleSidebar()`
- **Logo:** Text "OMNISTREAM" in Orbitron font, 20px, bold, white. NOT just text — styled with letter-spacing: 2px. Links to `/`
- **Search bar (center-right):** Rounded input `bg-surface`, `border-border`, placeholder "Search...", search icon left. Width ~400px on desktop. Opens SearchModal on focus/click or Ctrl+K
- **Bell icon:** Notification bell, lucide `Bell` icon, 20px, text-secondary
- **Sign In:** Arrow-right icon + text, links to auth modal. When logged in: shows user avatar circle

### 4.2 Sidebar (`src/components/layout/Sidebar.tsx`)
**Collapsed:** 0px width (hidden), content shifts left. **Expanded:** 240px overlay on mobile, push on desktop.

**Sidebar sections (from Animetsu analysis):**
```
─── Main ───
🏠 Home           → /
🔍 Discover       → /search
📅 Schedule       → /schedule
🕐 Watch History  → /history

─── Categories ───
🎬 Movies         → /search?type=movie
📺 TV Shows       → /search?type=tv
🎌 Anime          → /search?type=anime
📖 Manga          → /search?type=manga

─── Account ───
📋 My List        → /watchlist
⚙️ Settings       → /profile
```

### 4.3 Bottom Nav Bar (`src/components/layout/MobileNav.tsx`)
**Screenshot reference:** "Bottom Nav Bar.png" — 5 tabs at bottom

**Visible only on mobile (<768px). Fixed bottom, bg-surface, h-16, z-50:**
```
[🏠 Home] [📅 Schedule] [🔲 Browse] [📊 My List] [👤 You]
```
Each icon is 20px lucide icon + 10px label below. Active tab = white icon, inactive = text-muted.

---

## 5. Home Page — Pixel-Level Breakdown

### 5.1 HeroBanner (`src/components/home/HeroBanner.tsx`)
**Screenshot reference:** HomePage Part 1 — "Background YouTube trailer", "trailer mute button", "Not just text but the Logo"

**Data source:** AniList trending anime query → top 5-8 results
```graphql
query { Page(perPage: 8) { media(type: ANIME, sort: TRENDING_DESC) {
  id title { english romaji } description bannerImage
  coverImage { extraLarge } trailer { id site }
  format averageScore episodes duration season seasonYear
} } }
```

**Structure (full viewport width, ~70vh height):**
```
┌─────────────────────────────────────────────────────────┐
│  [Background: YouTube trailer iframe, muted autoplay]   │
│  OR [bannerImage with Ken Burns slow-zoom animation]    │
│                                                         │
│  Bottom gradient overlay (transparent → black)          │
│                                                         │
│  ┌─ Content (bottom-left, padding 40px) ──────────┐    │
│  │ TITLE (24px, bold, white, max-w-[600px])       │    │
│  │                                                 │    │
│  │ [TV Show] [87%] [24 min] [FALL 1999]           │    │ ← badges row
│  │                                                 │    │
│  │ Description text (14px, text-secondary,         │    │
│  │ max 2 lines, line-clamp-2)                      │    │
│  │                                                 │    │
│  │ [▶ Watch Now] [🔖 Bookmark] [🔊 Mute/Unmute]  │    │ ← action row
│  └─────────────────────────────────────────────────┘    │
│                                          [◀] [▶]       │ ← carousel nav arrows (right side)
└─────────────────────────────────────────────────────────┘
```

**Badge styling:**
- "TV Show": `bg-[#333] text-white text-[11px] px-2 py-0.5 rounded`
- "87%": `bg-accent-green text-black text-[11px] px-2 py-0.5 rounded font-bold` (green = score > 75, yellow 50-75, red < 50)
- "24 min": same as TV Show badge
- "FALL 1999": same as TV Show badge

**YouTube background behavior:**
- Uses `react-youtube` with `playerVars: { autoplay: 1, mute: 1, controls: 0, loop: 1, modestbranding: 1, showinfo: 0 }`
- Mute button (top-right of banner): toggles audio. Icon = `Volume2` / `VolumeX`
- If no trailer → show `bannerImage` as `object-cover` bg with slow Ken Burns CSS animation
- Auto-cycles every 8 seconds if user hasn't interacted

**Carousel navigation:**
- Right side: two circular buttons `[◀] [▶]`, `bg-surface/80 hover:bg-surface`, 40px circle

### 5.2 Jump Back In / Dive Back In (`src/components/home/ContinueWatching.tsx`)
**Screenshot reference:** HomePage Part 1 — "Recent Played" section

**Only shown if user has watch history in localStorage.**

**Data source:** `localStorage` → `watchHistory[]` → last 6 entries

**Section header:** "Jump Back In" (or "Dive Back In") — 20px semibold white, right side "→" arrow link to /history

**Card layout (horizontal scroll, 5 visible on desktop):**
```
┌──────────────────────┐
│  [Episode thumbnail]  │  ← 16:9 aspect ratio, from episode still image
│  ██████░░░  24:43    │  ← progress bar (green) + duration badge (bottom-right)
├──────────────────────┤
│  Attack on Titan      │  ← show/movie name (13px, text-secondary)
│  To You Two Thousand  │  ← episode title (14px, white, bold)
│  Years Later          │
└──────────────────────┘
```

**Progress bar:** green `bg-accent-green h-[3px]` at bottom of thumbnail, width = (watched / total) * 100%
**Duration badge:** `bg-black/80 text-white text-[11px] px-1 rounded` positioned bottom-right of thumbnail

**Thumbnail source:** For anime episodes, use Jikan episode images or AniList media image. For TMDB: episode still_path.

### 5.3 Trending Now (`src/components/home/TrendingRow.tsx`)
**Screenshot reference:** HomePage Part 2 — "Trending Section" with red box

**Data source:** AniList trending query
```graphql
query { Page(perPage: 15) { media(type: ANIME, sort: TRENDING_DESC) {
  id title { english romaji } coverImage { large }
  format averageScore seasonYear
} } }
```

**Section header:** "Trending Now" — 20px semibold white + "→" arrow right

**Horizontal scrollable row (Swiper.js, freeMode, slidesPerView: auto):**
```
┌──────────┐
│          │  ← poster image, 3:4 aspect ratio (~150px wide, ~200px tall)
│  [poster]│
│          │  ★ 7.8  ← gold star + rating badge, top-right corner
│          │      positioned absolute, bg-accent-gold text-black
│          │      rounded-bl-lg, text-[12px] font-bold, padding 2px 6px
├──────────┤
│ TV Show    2026 │  ← format + year, 11px, text-secondary, flex justify-between
│ ● Title Name... │  ← green dot + title, 13px, text-white, line-clamp-1
└──────────┘
```

**Green dot before title:** `w-2 h-2 rounded-full bg-accent-green inline-block` — indicates "currently airing" (only shown if status === "RELEASING" or "AIRING")

**Card width:** ~150px each, gap-3 between cards
**Hover effect:** Scale 1.05, brightness increase, 200ms transition

### 5.4 Tabbed Content Grid (`src/components/home/TabbedGrid.tsx`)
**Screenshot reference:** HomePage Part 2 — "Tab" section with "This Season / All Time Popular / Top Rated"

**Tab bar (3 tabs, underline style):**
```
[This Season]  [All Time Popular]  [Top Rated]
```
- Each tab: `text-[14px] px-6 py-2`, inactive = `text-secondary border-b-2 border-transparent`, active = `text-white border-b-2 border-accent-green`
- Tab container: `border-b border-border`

**Data sources per tab:**
- **This Season:** AniList `{ media(type: ANIME, season: SPRING, seasonYear: 2026, sort: POPULARITY_DESC, perPage: 18) }`
- **All Time Popular:** AniList `{ media(type: ANIME, sort: POPULARITY_DESC, perPage: 18) }`
- **Top Rated:** AniList `{ media(type: ANIME, sort: SCORE_DESC, perPage: 18) }`

**Grid layout:** Same card style as Trending Now, but in a responsive grid:
- Mobile: 3 columns
- Tablet: 4 columns  
- Desktop: 6 columns
- Gap: 12px

**"View more" button:** Full-width, `bg-surface hover:bg-surface-hover border border-border rounded py-3 text-center text-secondary text-[14px]`. Links to `/search?sort=<tab>`

### 5.5 Recent Comments Sidebar (`src/components/home/RecentComments.tsx`)
**Screenshot reference:** HomePage Part 2 — "Comment Section" on the right side

**Position:** Right sidebar next to the Tabbed Grid, ~300px wide, only visible on desktop (≥1280px)

**Header:** "Recent Comments" — 16px semibold white

**Comment card structure:**
```
┌─────────────────────────────────────────────┐
│ [avatar 32px] toshiro  14m ago              │
│                                             │
│ ┌─ Referenced episode ───────────────────┐  │
│ │ Classroom of the Elite...  Ep 10  [img]│  │
│ └────────────────────────────────────────┘  │
│                                             │
│ "im not cheesing at the scene of them..."   │
│                                   💬0  👍0  │
└─────────────────────────────────────────────┘
```

**Data source consideration:** Neither AniList nor Jikan provides user comments in real-time. **Alternative:** We'll create a mock/simulated comments system using localStorage. Users can post comments that persist locally. For the "Recent Comments" widget, we show the user's own recent comments. If empty, show a placeholder: "Be the first to comment! Share your thoughts on what you're watching."

### 5.6 Estimated Schedule (`src/components/home/ScheduleWidget.tsx`)
**Screenshot reference:** HomePage Part 3 — "Next Schedule" with day tabs

**Position:** Right sidebar, below Recent Comments (desktop only)

**Header:** "Estimated Schedule" — 16px semibold white + "→" arrow

**Day tabs (horizontal):**
```
[Mon May 11] [Tue May 12] [Wed May 13*] [Thu May 14] [Fri May 15]
```
Active day: `bg-white text-black rounded`, inactive: `bg-transparent text-secondary`

**Data source:** Jikan schedules endpoint
```
GET /api/jikan/schedules?day=wednesday
→ Returns anime airing on that day with: title, episode number, air time
```

**Schedule list:**
```
04:06  Chibi Godzilla Raids Again Season 3     [Ep 46]
05:00  mofusand                                  [Ep 19]
19:00  Re:ZERO -Starting Life in Another World-  [Ep 6]
```
- Time: `text-muted text-[13px] w-[50px]`
- Title: `text-white text-[13px] flex-1 line-clamp-1`
- Episode badge: `bg-surface text-secondary text-[12px] px-2 py-0.5 rounded`

### 5.7 Top Upcoming (`src/components/home/TopUpcoming.tsx`)
**Screenshot reference:** HomePage Part 3 — "Top Upcoming" section at bottom

**Data source:** AniList upcoming anime
```graphql
query { Page(perPage: 6) { media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) {
  id title { english romaji } coverImage { large } description
  source format genres startDate { year month day }
  studios(isMain: true) { nodes { name } }
} } }
```

**Horizontal scrollable cards (wider landscape format, ~400px wide):**
```
┌──────────────────────────────────────────┐
│ [Poster     ] Ep 1 airing in             │
│ [150x200px  ] 2 months                   │
│ [           ] Source: LIGHT NOVEL         │
│ [           ]                             │
│ [           ] Description text (2 lines)  │
│ [           ]                             │
│ Title Name                                │
│ STUDIO NAME                               │
│ [Adventure] [Drama] [Ecchi]  ← genre tags │
└──────────────────────────────────────────┘
```

**"Ep 1 airing in" + countdown:** Calculate from AniList `startDate`. Show "X months" or "MMM YYYY"
**Genre tags:** `bg-accent-green/20 text-accent-green text-[11px] px-2 py-0.5 rounded`
**Studio:** `text-accent-green text-[12px] uppercase font-bold`

### 5.8 Recently Updated (`src/components/home/RecentlyUpdated.tsx`)
**Screenshot reference:** HomePage Part 4 — "Recent Uploads" YouTube-style grid

**Data source:** AniList recently updated anime
```graphql
query { Page(perPage: 20) { media(type: ANIME, status: RELEASING, sort: UPDATED_AT_DESC) {
  id title { english romaji } coverImage { large }
  episodes nextAiringEpisode { episode airingAt }
  format
} } }
```

**YouTube-style card grid (5 columns desktop, 3 mobile, 2 small mobile):**
```
┌─────────────────────────────────┐
│ [Episode thumbnail - 16:9]      │
│                         Ep 8   │  ← episode badge, bottom-right, bg-black/80
├─────────────────────────────────┤
│ [poster 32px circle] Episode 8  │  ← "channel image" = show poster (circular)
│                      Show Name  │  ← "channel" = show/anime name (text-secondary)
│                      X views • 2h ago │
└─────────────────────────────────┘
```

**Key annotations from screenshot:**
- "Channel image is main character or Poster" → Use circular cropped poster image (32px)
- "Title is episode name or movie name" → Show "Episode X" as title
- "Channel is movie/show name" → Show anime/movie title below
- "Hover will play the video" → On hover, show a play icon overlay (we won't actually play inline, just link to watch page)
- "Thumbnail" → Use the anime's banner/cover image
- "Episode number" → Badge `bg-black/80 text-[11px]` at bottom-right of thumbnail

**Thumbnail source:** Since AniList doesn't provide per-episode images, use the anime's `coverImage.large` or `bannerImage` with an overlay showing the episode number.

---

*Continued in Part 2: Detail Pages, Video Player, Manga Reader*
