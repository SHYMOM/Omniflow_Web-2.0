# OmniStream — Complete Implementation Plan

> **~99 files · 10 execution batches · 4 APIs (AniList, Jikan, TMDB, MangaUpdates)**

This plan is split into 4 parts due to size. Each part contains pixel-level detail derived from the 16 annotated screenshots.

---

## Plan Documents

### [Part 1 — Foundation & Home Page](file:///C:/Users/USERAS/.gemini/antigravity/brain/72c07486-bc06-499d-acdb-a9f368faf1fd/implementation_plan_part1.md)
- §1 Project scaffold & config
- §2 Design system (colors, typography, Tailwind tokens)
- §3 Hybrid API architecture (proxy routes, GraphQL queries, rate limiting, MediaItem interface)
- §4 Layout components (Topbar, Sidebar, MobileNav)
- §5 Home page sections (HeroBanner, ContinueWatching, TrendingRow, TabbedGrid, RecentComments, Schedule, TopUpcoming, RecentlyUpdated)

### [Part 2 — Cards, Details & Video Player](file:///C:/Users/USERAS/.gemini/antigravity/brain/72c07486-bc06-499d-acdb-a9f368faf1fd/implementation_plan_part2.md)
- §6 MediaCard & HoverCard (trailer autoplay, metadata, actions)
- §7 Detail pages — all 5 tabs (Overview, Episodes, Characters, Related, More Like This)
- §8 Video Player page (embed, anti-redirect shield, server switching, episode sidebar, comments)

### [Part 3 — Auth, History, Search & Manga](file:///C:/Users/USERAS/.gemini/antigravity/brain/72c07486-bc06-499d-acdb-a9f368faf1fd/implementation_plan_part3.md)
- §9 Sign-in modal (split-panel with anime art)
- §10 Watch History page (date-grouped, progress bars)
- §11 Search page (filter sidebar, multi-source query)
- §12 Manga detail & reader (webtoon + traditional modes)
- §13 State management (Zustand stores)
- §14 Custom hooks
- §15 React Query configuration

### [Part 4 — File Inventory & Execution](file:///C:/Users/USERAS/.gemini/antigravity/brain/72c07486-bc06-499d-acdb-a9f368faf1fd/implementation_plan_part4.md)
- §16 Watchlist & Profile pages
- §17 Loading & error states
- §18 Complete file inventory (all ~99 files listed)
- §19 Execution order (10 batches with dependencies)
- §20 Verification plan (build, browser, API testing)
- §21 Key technical decisions summary

---

## Quick Reference: Execution Batches

| # | What | Count |
|---|------|-------|
| 1 | Project init, deps, configs | 5 |
| 2 | Design system (Tailwind, CSS, fonts) | 3 |
| 3 | Type definitions | 5 |
| 4 | API proxy routes + client functions | 18 |
| 5 | Utils, hooks, stores, React Query | 11 |
| 6 | Layout (Sidebar, Topbar, MobileNav, root layout) | 4 |
| 7 | Shared UI + Media components | 12 |
| 8 | Home page + all sections | 9 |
| 9 | Detail, Search, Watch, Read, Auth, Profile, History | 20 |
| 10 | Loading/error states, polish | 20 |

---

> [!IMPORTANT]
> **Please review all 4 parts and confirm approval before I begin building.** Once approved, I'll execute batch-by-batch starting with project initialization.
