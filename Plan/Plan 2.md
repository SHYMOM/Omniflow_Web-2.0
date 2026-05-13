# OmniStream — Detailed Implementation Plan (Part 2 of 4)

## 6. MediaCard & HoverCard Components

### 6.1 MediaCard (`src/components/media/MediaCard.tsx`)
**Screenshot reference:** "Home Page Card Hover.png" — pink "Home Screen Card" annotation

**Card dimensions:** ~150px wide, flexible height
**Aspect ratio:** Poster area = 3:4 (150×200px)

**Structure:**
```
┌──────────────────┐
│                  │
│   [Poster img]   │  ← next/Image, object-cover, rounded-lg
│                  │
│              ★8.7│  ← Rating badge: absolute top-right
│                  │     bg-accent-gold text-black text-[12px]
│                  │     font-bold px-1.5 py-0.5 rounded-bl-lg
└──────────────────┘
  TV Show     1999    ← format + year, flex justify-between
  ● ONE PIECE         ← green dot (if airing) + title, line-clamp-1
```

**Rating badge logic:**
- Score from AniList: `averageScore` (0-100) → display as `(score/10).toFixed(1)` → e.g. "8.7"
- Score from TMDB: `vote_average` (0-10) → display directly → e.g. "7.8"
- Star icon: `★` character or lucide `Star` filled, size 10px, inline before number
- Badge color: Always `bg-accent-gold` (yellow/gold)

**Green status dot:**
- Only show if `status === "RELEASING"` or `status === "Currently Airing"`
- `w-2 h-2 rounded-full bg-accent-green inline-block mr-1`

**Hover behavior:**
- After 400ms hover delay → show HoverCard popover
- Card itself: `transition-transform duration-200 hover:scale-105`

### 6.2 HoverCard (`src/components/media/HoverCard.tsx`)
**Screenshot reference:** "Home Page Card Hover.png" — green "Hover Card" box, red annotations

**Trigger:** 400ms delay on MediaCard hover. Uses `onMouseEnter`/`onMouseLeave` with timeout.
**Position:** Appears as an overlay/popover, centered relative to the hovered card. ~350px wide.
**Animation:** Framer Motion `initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}`

**Structure:**
```
┌─────────────────────────────────────┐
│  [YouTube Trailer - autoplay muted] │  ← 16:9 area, ~350x200px
│  OR [Backdrop/Banner image]         │
│                            [🔊]     │  ← Mute toggle button (top-right)
├─────────────────────────────────────┤
│  ONE PIECE                          │  ← Title, 18px semibold white
│                                     │
│  [TV Show] [AIRING] [Action] [Adv]  │  ← Tag badges
│                                     │
│  ☆ 87%   ⏱ 24 min   📅 Oct 20,1999│  ← Metadata row
│                                     │
│  Gold Roger was known as the Pirate │  ← Description, 13px, text-secondary
│  King, the strongest and most...    │     line-clamp-3
│                                     │
│  [  ▶ Watch now  ]  [🔖]           │  ← Action buttons
└─────────────────────────────────────┘
```

**Tag badges styling:**
- "TV Show": `bg-[#333] text-white text-[11px] px-2 py-0.5 rounded`
- "AIRING": `bg-accent-green text-black text-[11px] px-2 py-0.5 rounded font-bold`
- Genre tags: `bg-[#333] text-white text-[11px] px-2 py-0.5 rounded`

**Metadata row:**
- `☆ 87%` → score with star icon, `text-accent-gold text-[13px]`
- `⏱ 24 min` → clock icon + duration, `text-secondary text-[13px]`
- `📅 Oct 20, 1999` → calendar icon + date, `text-secondary text-[13px]`

**Action buttons:**
- "Watch now": `bg-white text-black font-semibold text-[14px] px-6 py-2.5 rounded-lg flex-1 flex items-center justify-center gap-2 hover:bg-gray-200`
- Bookmark icon: `bg-surface border border-border p-2.5 rounded-lg hover:bg-surface-hover`

**YouTube trailer in HoverCard:**
- Fetch trailer via: AniList `trailer { id site }` → if site === "youtube", use `id`
- Use `react-youtube` with: `autoplay: 1, mute: 1, controls: 0, loop: 1`
- If no trailer available → show `bannerImage` or `coverImage` as static image
- Mute button: absolute positioned top-right of video area

---

## 7. Detail Pages (Anime/Movie/TV)

### 7.1 Detail Page URL Structure
```
/anime/[id]   → AniList anime ID (e.g. /anime/21 for One Piece)
/movie/[id]   → TMDB movie ID (e.g. /movie/927085)
/tv/[id]      → TMDB TV ID (e.g. /tv/158876)
/manga/[id]   → AniList manga ID
```

### 7.2 Detail Header (`src/components/details/DetailHeader.tsx`)
**Screenshot reference:** "DetailsPage Overview Tab Part 1.png"

**Annotations from screenshot:**
- "Details Page" at top
- "Poster" with arrow (left side)
- "Extra link or share" (green box around share/AL/MAL buttons)
- "Description" (right side)
- "Tab bar" (yellow box around Overview/Episodes/Related/More like this)
- "Next Part date" (next episode airing notification)

**Top navigation bar (inside detail page):**
```
[← Back]                                    [🔔] [🔍]
```
- Back button: `bg-transparent text-white` + chevron-left icon, navigates `router.back()`

**Banner area (full-width, ~250px height):**
```
┌─────────────────────────────────────────────────────────┐
│  [Banner Image - object-cover, full bleed]              │
│  (from AniList bannerImage or TMDB backdrop_path)       │
│  Bottom gradient: linear-gradient(transparent, #0a0a0a) │
└─────────────────────────────────────────────────────────┘
```

**Content area (below banner, overlapping slightly):**
```
┌──────────────────────────────────────────────────────────┐
│ [Poster   ] [AIRING]  ← status badge, green bg          │
│ [120×170  ] ONE PIECE  ← title, 24px bold white          │
│ [rounded  ]                                              │
│ [corners  ] [TV Show] [FALL] [1999]  ← metadata badges   │
│             ← badges: bg-surface border border-border     │
│                                                           │
│ [▶ Watch Now] [🔖] [🔗] [AL] [MAL]                      │
│  ← Watch: bg-white text-black rounded-lg px-4 py-2       │
│  ← Bookmark: bg-surface border rounded-lg p-2            │
│  ← Share: bg-surface border rounded-lg p-2               │
│  ← AL: AniList link, bg-[#02a9ff] rounded-lg p-2         │
│  ← MAL: MAL link, bg-[#2e51a2] rounded-lg p-2            │
│                                                           │
│ Description text... (14px, text-secondary, expandable)    │
│                                                           │
│ ═══════════════════════════════════════════════════════   │
│ [Overview] [Episodes] [Characters] [Related] [More ...]  │
│  ← Tab bar with underline indicator                       │
└──────────────────────────────────────────────────────────┘
```

**External links (from screenshot green box):**
- Share button: Opens native `navigator.share()` or copies URL
- "AL" button (AniList): `https://anilist.co/anime/{anilistId}`, bg-[#02a9ff]
- "MAL" button (MyAnimeList): `https://myanimelist.net/anime/{malId}`, bg-[#2e51a2]

### 7.3 Overview Tab (`src/components/details/OverviewTab.tsx`)
**Screenshot references:** "DetailsPage Overview Tab Part 1.png" + "DetailsPage Overview Tap Part 2.png"

**Part 1 — Next Episode Banner:**
```
┌─────────────────────────────────────────────────┐
│ 🔔 Next ep airing  in 4 days                    │
└─────────────────────────────────────────────────┘
```
- Full-width bar, `bg-surface border border-border rounded-lg py-3 text-center`
- Bell icon + "Next ep airing" in `text-secondary`, "in 4 days" in `text-accent-green`
- Data: AniList `nextAiringEpisode { airingAt episode }` → calculate relative time

**Stats row (3 columns):**
```
┌─────────────────┬─────────────────┬─────────────────┐
│  Average Score   │     Type        │    Duration      │
│     8.7          │   TV Show       │    24 min        │
└─────────────────┴─────────────────┴─────────────────┘
```
- `bg-surface rounded-lg`, 3 equal columns, center-aligned
- Label: `text-secondary text-[12px]`, Value: `text-white text-[16px] font-semibold`

**Info table (key-value pairs):**
```
Start:         Oct 20, 1999
End:           ?
Season:        FALL 1999
Status:        AIRING       ← green text
Mean Score:    87
Source:        MANGA
Country:       JP
Hashtag:       #ONEPIECE
Native Title:  ONE PIECE
Synonyms:      ワンピース, 海賊王, וואן פיס
```
- Left column: `text-secondary text-[14px]`, right column: `text-white text-[14px]`
- Alternating row backgrounds: even rows `bg-surface`, odd rows `bg-transparent`
- "AIRING" status: `text-accent-green`

**Data mapping per field:**
| Field | AniList Source | TMDB Source |
|-------|---------------|-------------|
| Start | `startDate { year month day }` | `first_air_date` / `release_date` |
| End | `endDate { year month day }` | `last_air_date` |
| Season | `season + seasonYear` | N/A (show "N/A") |
| Status | `status` | `status` |
| Score | `meanScore` | `vote_average * 10` |
| Source | `source` (MANGA, LIGHT_NOVEL, etc) | N/A |
| Country | `countryOfOrigin` | `origin_country[0]` |
| Native Title | `title.native` | `original_title` |
| Synonyms | `synonyms[]` | N/A |

**Part 2 — Trailer Section:**
```
Trailer
┌───────────────────────┐
│  [YouTube embed]       │  ← 16:9, max-width 400px
│  [with play button]    │
└───────────────────────┘
```
- YouTube embed using `react-youtube`, `trailer.id` from AniList
- For TMDB: filter `videos.results` for `type === "Trailer" && site === "YouTube"`

**Studios section:**
```
Studios
[Toei Animation] [Funimation] [Fuji TV] [4Kids Entertainment] ...
```
- Tags: `bg-surface border border-border text-secondary text-[13px] px-3 py-1 rounded-full`
- Data: AniList `studios { nodes { name } }` / TMDB `production_companies`

**Genres section:**
```
Genres
[Action] [Adventure] [Comedy] [Drama] [Fantasy]
```
- Same tag styling as Studios

**Tags section (AniList only):**
```
Tags
[Pirates] [Travel] [Shounen] [Ensemble Cast] [Super Power] ...
```
- AniList `tags { name rank }` — show all tags
- Same tag styling, possibly wrap to multiple lines

**Characters section:**
```
Characters                                          show more →
┌────────────────────────────────────────────────────────────┐
│ [char img] Luffy D. Monkey   Mayumi Tanaka  [VA img]      │
│            MAIN              Japanese                      │
├────────────────────────────────────────────────────────────┤
│ [char img] Robin Nico        Yuriko Yamaguchi [VA img]    │
│            MAIN              Japanese                      │
└────────────────────────────────────────────────────────────┘
```
- Two-column layout: character on left side, voice actor on right side
- Character image: 48px square, rounded
- Character name: `text-white text-[14px]`
- Role: `text-secondary text-[12px]` (MAIN, SUPPORTING)
- VA name: `text-white text-[14px]` right-aligned
- VA language: `text-secondary text-[12px]` right-aligned
- VA image: 48px square, rounded, right-aligned
- Data: AniList `characters { edges { role node { name image } voiceActors { name image } } }`
- For TMDB: use `credits.cast` → character name + actor name + profile_path

**Staff section:**
```
Staff
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ [photo]│ │ [photo]│ │ [photo]│ │ [photo]│
│        │ │        │ │        │ │        │
│Creator │ │Director│ │Char Des│ │Music   │
│ Name   │ │ Name   │ │ Name   │ │ Name   │
└────────┘ └────────┘ └────────┘ └────────┘
```
- Horizontal scroll of staff photos
- Photo: 80×100px, rounded-lg, object-cover
- Role: `text-secondary text-[11px]`
- Name: `text-white text-[13px] font-medium`
- Data: AniList `staff { edges { role node { name image } } }`
- For TMDB: use `credits.crew` filtered for director, writer, etc.

### 7.4 Episodes Tab (`src/components/details/EpisodesTab.tsx`)
**Screenshot reference:** "DetailsPage Episode Tab.png"

**Annotations:** "Season divider", "Switch Grid view/List view", "Sort button by Episode", "Hover plays the video"

**Top controls bar:**
```
[1164 Episodes] [<<] [<] [1 - 39] [>] [>>]     [⊞ Grid] [≡ List] [↕ Sort]
```
- Episode count: `text-secondary text-[13px]`
- Pagination: `bg-surface border border-border rounded px-2 py-1 text-[13px]`
- Range display: `text-white text-[13px]`
- View toggles: two icon buttons, active = `bg-accent-green/20 text-accent-green`, inactive = `text-secondary`
- Sort: dropdown (Ascending/Descending by episode number)

**Pagination logic:**
- Show 30 episodes per page (6 rows × 5 columns in grid, or 30 list items)
- `<<` = first page, `<` = prev, `>` = next, `>>` = last
- Range shows "1 - 30", "31 - 60", etc.

**Grid view (default) — episode cards:**
```
┌─────────────────────┐
│  [Episode thumbnail] │  ← 16:9, from Jikan episode images
│  Ep 1     👁 470K   │  ← episode badge + view count
│  ▶ (hover overlay)  │  ← play icon on hover
├─────────────────────┤
│  I'm Luffy! The Man │  ← episode title, 13px, white
│  Who's Gonna Be...  │     line-clamp-2
└─────────────────────┘
```
- Grid: 6 columns desktop, 4 tablet, 3 mobile
- Episode badge: `bg-accent-green text-black text-[11px] font-bold px-1.5 py-0.5 rounded`, absolute bottom-left
- View count: `text-secondary text-[11px]` + eye icon, absolute bottom-right
- Hover: darken overlay + centered play icon `▶`
- Click → navigates to `/watch?id={mediaId}&ep={episodeNumber}`

**Episode thumbnail source:**
- AniList doesn't provide episode images
- Jikan: `GET /anime/{malId}/episodes` → per-episode data, but no images directly
- Jikan: `GET /anime/{malId}/videos/episodes` → HAS episode images (`images.jpg.image_url`)
- Fallback: Use anime's `coverImage` with episode number overlay

**Data source for episodes:**
```
Primary: Jikan GET /anime/{malId}/videos/episodes → episode images
Secondary: Jikan GET /anime/{malId}/episodes → titles, aired dates, filler/recap flags
For TMDB: GET /tv/{id}/season/{s} → episodes with still_path, name, overview, vote_count
```

**View count display:**
- For Jikan: Not available → show "—" or hide
- For TMDB: Use `vote_count` as proxy for "views"
- Format: `formatViewCount(470000)` → "470K"

### 7.5 Characters Tab (anime only)
**Screenshot reference:** Tab bar shows "Characters" between Episodes and Related

Full grid of characters, same layout as Overview tab characters section but expanded to show all.

### 7.6 Related Tab (`src/components/details/RelatedTab.tsx`)
**Screenshot reference:** "DetailsPage Related Tab.png"

**Filter chips at top:**
```
[All] [PREQUEL] [SIDE STORY] [SUMMARY] [CHARACTER] [SPIN OFF] [ALTERNATIVE] [OTHER]
```
- Chip styling: `bg-surface border border-border text-white text-[13px] px-3 py-1.5 rounded-full`
- Active chip: `bg-white text-black`
- "All" is default selected

**Relation cards grid (same style as MediaCard but with relation badge):**
```
┌──────────────────┐
│  [SIDE STORY]    │  ← Relation type badge, absolute top-left
│                  │     bg-surface/90 text-white text-[11px] px-2 py-1
│  [Poster image]  │
│                  │
└──────────────────┘
  MOVIE     2002
  One Piece: Chopper's Kingdom...
```
- Grid: 7 columns desktop, 5 tablet, 3 mobile
- Data: AniList `relations { edges { relationType node { ... } } }`
- For TMDB: Not a direct equivalent. We'll show TMDB `similar` results with "SIMILAR" badge

### 7.7 More Like This Tab (`src/components/details/MoreLikeThisTab.tsx`)
**Screenshot reference:** "DetailsPage More Like This Tab.png"

**Simple grid of recommended media, same card style as MediaCard:**
```
┌──────────────────┐
│  [Poster image]  │
│                  │
└──────────────────┘
  TV Show     2002
  Naruto
```
- Grid: 7 columns desktop, 5 tablet, 3 mobile
- No relation badge (unlike Related tab)
- Data: AniList `recommendations { nodes { mediaRecommendation { ... } } }`
- For TMDB: `recommendations` endpoint

---

## 8. Video Player Page

### 8.1 Watch Page (`src/app/watch/page.tsx`)
**Screenshot reference:** "Video Player Page.png"

**URL:** `/watch?id={mediaId}&type={anime|movie|tv}&ep={episodeNumber}&s={season}`

**Layout — 2 column on desktop, single column on mobile:**
```
┌──────────────────────────────────────┬──────────────────────┐
│  [Video Player iframe - 16:9]        │ Up Next - Episode 2  │
│                                      │ Playing - Ep 1 - ... │
│  ┌────────────────────────────────┐  │                      │
│  │  [Anti-redirect shield layer]  │  │ [Search Episode ___] │
│  │  [Embed from selected server]  │  │ [🔄] [↕] [≡]       │
│  └────────────────────────────────┘  │                      │
│  [▶] [⏭] [🔊] 2:48/25:00  [⚙][🖼] │ ┌──────────────────┐ │
│                            [🖥][⛶]  │ │[thumb] Ep 1      │ │
│                                      │ │ 470K • 27y ago   │ │
│  ⚠ If current server doesn't work.. │ ├──────────────────┤ │
│                                      │ │[thumb] Ep 2      │ │
│  Episode Title                       │ │ 15K • 27y ago    │ │
│  [poster 40px] Show Name             │ ├──────────────────┤ │
│                7.2K users  [Add List]│ │[thumb] Ep 3      │ │
│                                      │ │ 11K • 26y ago    │ │
│  [👍 622] [👎 4] [🎤Dub] [📺Server] │ └──────────────────┘ │
│  [🔗Share] [⬇Download] [🚩Report]   │                      │
│                                      │ 🔔 Next ep airing   │
│  470K views  Oct 20, 1999            │    in 4 days         │
│  Description text...                 │                      │
│                                      │ More like this       │
│  ──────────────────────────────────  │ ┌──────────────────┐ │
│  68 Comments         [EP 1] [Sort]   │ │[poster] PREQUEL  │ │
│  ┌────────────────────────────────┐  │ │ MONSTERS: 103... │ │
│  │ [avatar] Did this episode...   │  │ │ ONA WINTER 2024  │ │
│  └────────────────────────────────┘  │ └──────────────────┘ │
│  [avatar] jozvert  1y ago            │                      │
│  "IS ANYONE SINGLE BI..."            │                      │
│  [👍3] [👎9] [Reply] [...More]       │                      │
└──────────────────────────────────────┴──────────────────────┘
```

### 8.2 Server Switching & Embed URLs
**servers.json structure:**
```json
[
  {
    "id": "vidsrc-icu",
    "name": "VidSrc ICU",
    "baseUrl": "https://vidsrc.icu/embed",
    "patterns": {
      "movie": "/movie/{tmdbId}",
      "tv": "/tv/{tmdbId}/{season}/{episode}",
      "anime_sub": "/anime/{malId}/{episode}/0",
      "anime_dub": "/anime/{malId}/{episode}/1"
    },
    "quality": ["1080p", "720p"],
    "features": ["sub", "dub"],
    "recommended": true
  },
  {
    "id": "vidzee",
    "name": "Vidzee",
    "baseUrl": "https://player.vidzee.wtf/embed",
    "patterns": {
      "movie": "/movie/{tmdbId}",
      "tv": "/tv/{tmdbId}/{season}/{episode}"
    },
    "quality": ["1080p"],
    "features": ["sub"],
    "recommended": false
  }
]
```

**Server switcher UI:** Horizontal chips row
```
[🟢 VidSrc ICU ★] [Vidzee] [Server 3] [Server 4] ...
```
- Active: `bg-accent-green/20 border-accent-green text-white`
- Inactive: `bg-surface border-border text-secondary`
- Recommended: `★` badge
- Click switches iframe src

### 8.3 Anti-Redirect Shield (`src/components/player/VideoPlayer.tsx`)
```tsx
<div className="relative">
  {/* Click-to-play overlay - shown before first play */}
  {!hasStarted && (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 cursor-pointer"
         onClick={() => setHasStarted(true)}>
      <PlayCircle size={64} className="text-white" />
    </div>
  )}
  
  {/* Event capture layer - prevents popups from iframe */}
  <div className="absolute inset-0 z-5 pointer-events-none" />
  
  <iframe
    src={embedUrl}
    sandbox="allow-scripts allow-same-origin allow-forms"
    // NO allow-top-navigation, NO allow-popups
    allowFullScreen
    className="w-full aspect-video rounded-lg"
  />
</div>
```

### 8.4 Episode Sidebar (right column)
**Header:**
```
Up Next - Enter the Great Swordsman!...
Playing - Episode 1 - ONE PIECE
```

**Controls row:**
```
[Search Episode ________] [🔄 Shuffle] [↕ Sort] [≡ View]
```

**Episode list (scrollable, max-height viewport):**
```
┌──────────────────────────────────────────────┐
│ [thumbnail 120×68] Ep 1  I'm Luffy! The Man │
│ [with Ep badge]         470K views • 27y ago │
├──────────────────────────────────────────────┤
│ [thumbnail]        Ep 2  Enter the Great...  │
│                         15K views • 27y ago  │
└──────────────────────────────────────────────┘
```
- Active episode: `bg-surface-hover border-l-2 border-accent-green`
- Thumbnail: 120×68px, rounded
- Title: `text-white text-[13px] line-clamp-1`
- Meta: `text-muted text-[11px]`

---

*Continued in Part 3: Sign-In, Watch History, Search, Manga Reader, Stores*
