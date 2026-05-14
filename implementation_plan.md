# OMNISTREAM Platform Refinement & Bug Resolution Plan

This plan details the comprehensive resolution of UI bugs, feature requirements, and architectural updates requested by the user to achieve a flawless, high-fidelity streaming platform with hybrid API capabilities matching the reference screenshots exactly.

## User Review Required

> [!IMPORTANT]
> **Pixel-Perfect Parity Alignment**: Following an in-depth review of the provided screenshots (`HomePage Full.png`, `Home Page Card Hover.png`, `Video Player Page.png`, `DetailsPage Overview Tab Part 1.png`, etc.), component layouts will adhere strictly to reference aesthetics:
> - **HoverCard**: Renders directly adjacent to the media card with spatial edge detection to invert horizontal placement if near screen margins. Integrates top-right trailer mute controls, centered red YouTube play icons, and complete metadata strips ending in full-width white action buttons.
> - **DetailHeader**: Matches the dark ambient aesthetic featuring bottom-left overlay titles, green `AIRING` indicators, and circular dark/blue external provider links labeled precisely as **`A.`** and **`MAL`**.
> - **Video Player Page**: Includes the top amber alert bar (*"If the current server doesn't work, feel free to try the other available servers."*), dedicated action rows with pop-up/dropdown lists for **Server** selections, collapsible descriptive paragraphs, and right-hand episode lists.

## Open Questions

> [!NOTE]
> 1. For the auto-playing trailer hero section, if YouTube embeds block direct programmatic autoplay without audio muting due to browser security policies, we will default the hero trailers to start muted with an explicit, visible "Unmute" control button.
> 2. Custom video server mapping strings incorporate the dual support parameters exactly as requested: `/embed/movie/{tmdbId}`, `/embed/tv/{tmdbId}/{season}/{episode}`, `/embed/anime/{malId}/{episode}`.

---

## Proposed Changes

### 1. Authentication & Navigation Layer

#### [MODIFY] src/components/auth/AuthModal.tsx
- Implement dynamic anime profile fetching. Pre-define a premium curation of top-tier anime character graphics (matching the vibrant visual fidelity of `Sign In Pop Up 1.png` and `Sign In Pop Up 2.png`) and randomize the selected profile picture upon component mount/visit.

#### [MODIFY] src/components/layout/Topbar.tsx
- Remove `readOnly` attribute from the global search input bar. Enable fully functional real-time text input.
- Trigger routing to `/search?q=...` seamlessly on `Enter` keypress or search button execution.

#### [MODIFY] src/components/layout/Sidebar.tsx
- Reroute category links (`Anime`, `Movies`, `TV Shows`, `Manga`) away from the generic Discover page to their dedicated routes (`/anime`, `/movies`, `/tv`, `/manga`).

---

### 2. Homepage & UI Component Optimization

#### [MODIFY] src/components/home/HeroBanner.tsx
- Replace static fallback images with full iframe-embedded YouTube trailer videos set to auto-play sequentially.
- Integrate an automatic slide advancement timer triggered upon trailer completion or timeout.

#### [MODIFY] src/components/media/HoverCard.tsx
- Implement edge-aware spatial positioning: detect horizontal bounding box distance to viewports. If a card is positioned on the screen's left half, trigger hover expansion towards the right; if on the right half, trigger expansion towards the left. This ensures the hover layout is never clipped by screen boundaries.
- Anchor absolute layout overlays matching the visual metadata structure from `Home Page Card Hover.png`.

#### [MODIFY] src/components/media/MediaCard.tsx
- Adjust layout dimensions to guarantee uniformity across all grid rows.
- Refine the rating badge background overlay to mirror the provided screenshot layout precisely (dark translucent capsule with prominent golden star alignment).
- Align bottom title overlay text with leading circular green badges for releasing media.

#### [MODIFY] src/components/home/TrendingRow.tsx
- Increase media fetching limit to at least 20 items for serial sequential display.
- Update "View All" redirection targets directly to `/trending`.

#### [MODIFY] src/components/home/TabbedGrid.tsx
- Standardize media card dimensions to align seamlessly with trending row viewports.
- Configure dedicated page routing targets for individual tab headers: `/season`, `/popular`, and `/top-rated`.

#### [MODIFY] src/components/home/RecentlyUpdated.tsx
- Embed dynamic upload timestamp calculations (e.g., "4 hours ago", "1 day ago").
- Enable direct navigation routing to corresponding media detail endpoints when clicking channel icon avatars or titles.
- Configure video auto-playback or preview video triggering on hover events.

#### [MODIFY] src/components/home/RecentComments.tsx
- Load static/cached premium comment entries to reflect active discussions while temporarily blocking direct comment submission state.

#### [MODIFY] src/components/home/TopUpcoming.tsx
- Expand available row item visibility limits and configure external routing mapping to `/upcoming`.

---

### 3. Dedicated Routing Endpoints [NEW]

#### [NEW] src/app/discover/page.tsx
- Implement a comprehensive multi-criteria media discovery dashboard featuring dynamic sidebar filters for format (Movies, TV, Anime, Manga), broadcast years, spoken language origins, and genres.

#### [NEW] src/app/trending/page.tsx
- Dedicated high-fidelity infinite grid page highlighting active hybrid trending items across movies, television, and anime.

#### [NEW] src/app/upcoming/page.tsx
- Standalone landing interface grouping anticipated future broadcasts.

#### [NEW] src/app/season/page.tsx
#### [NEW] src/app/popular/page.tsx
#### [NEW] src/app/top-rated/page.tsx
#### [NEW] src/app/anime/page.tsx
#### [NEW] src/app/movies/page.tsx
#### [NEW] src/app/tv/page.tsx
#### [NEW] src/app/manga/page.tsx
- Dedicated layout matrices restricted strictly to their respective content types.

---

### 4. Hybrid API Aggregation System

#### [NEW] src/lib/api/hybrid.ts
- Provide server-side fetching adapters merging data payloads from TMDB endpoints, AniList GraphQL schemas, and Jikan REST endpoints into a harmonized `UnifiedMedia` output structure. Supports dual-identifier extraction (`tmdbId` and `malId`).

---

### 5. Video Playback & Details Refinement

#### [MODIFY] public/servers.json
- Update internal JSON configuration mappings incorporating all multi-server configurations provided by the user (`VidFast`, `VidSrc`, `AutoEmbed`, etc.) with explicit template flags supporting distinct media formats.

#### [MODIFY] src/app/watch/page.tsx
- Implement fully-featured UI modules matching `Video Player Page.png`: top warning alert strips, actionable row blocks with an isolated **Server** selection pop-up modal containing administrative recommendation stars, line-clamped dynamic descriptions, right-aligned episode layout grids, and "More like this" preview cards.
- Configure dynamic fallback displays rendering the `RecentlyUpdated` module if target episodes contain zero associated user comments.

#### [MODIFY] src/components/player/ServerSwitcher.tsx
- Extract primary server switching button triggers from plain website viewports and enclose them inside a dedicated clean floating modal/popup interface highlighting administrative recommendations.

#### [MODIFY] src/components/details/OverviewTab.tsx
- Enable description paragraph line-clamping set to minimal initial displays, supplemented by clickable "Show more" expansion links and "Show less" collapsing handlers.
- Add dynamic "View All" modal/drawer actions for full access to sprawling character casts and behind-the-scenes staff lists.

#### [MODIFY] src/components/details/DetailHeader.tsx
- Format primary headers matching reference graphics, incorporating blue/dark circular buttons with crisp **`A.`** and **`MAL`** text strings.
- Insert strict spatial separation padding dividing media format text tags and broadcast year labels.

#### [MODIFY] src/components/details/EpisodesTab.tsx
- Refactor list components to cleanly output active episode thumbnails matching reference layouts.
- Introduce dedicated season filter selection dropdowns/tabs.

#### [MODIFY] src/components/details/RelatedTab.tsx
- Apply interactive hover effects matching standard trending row card styling to all related items.

---

### 6. User Watch History Persistence & Backups

#### [MODIFY] src/app/history/page.tsx
- Build intuitive interaction components matching `Watch History Page.png` supporting granular line-item deletion actions and master cache purge operations.
- Introduce client-side string filtering search bars for rapid history lookup.
- Embed active tracking suspension buttons ("Pause Watch History").
- Develop integrated JSON File Export/Import module pipelines allowing safe local backup snapshots of client watch databases.

---

## Verification Plan

### Automated/Client-Side Verification
- Validate clean TypeScript builds (`npm run build` checks) to confirm type compatibility across hybrid mapping transformations.
- Run multi-viewport grid responsive reflow checks to ensure card elements retain correct size scales.

### Manual Verification Flow
- **Search flow**: Enter text inside top header navigation bar; press Enter to verify instant transition to `/search` output list.
- **Hover detection**: Trigger mouse enter over items occupying extreme left/right grid margins to verify responsive opposite-direction popup anchoring matching `Home Page Card Hover.png`.
- **Video execution**: Select individual media episodes; test pop-up modal server switching triggers to confirm dynamic URL placeholder substitution.
- **Persistence safety**: Trigger watch history generation; download backup JSON payloads, clear cache tables, and import local JSON structures to verify 100% data restoration.
