# OMNISTREAM Site Audit & Bug Report (May 14, 2026)

This report details the critical bugs, runtime errors, and functional regressions discovered during a comprehensive site audit.

## 1. Critical Runtime Crashes
- **HeroBanner Crash**: `ReferenceError: useRef is not defined`.
  - **Status**: [FIXED] Added `useRef` to React imports.
- **OverviewTab Crash**: `ReferenceError: Maximize2 is not defined`.
  - **Status**: [FIXED] Added missing `lucide-react`, `framer-motion`, and `Portal` imports.

## 2. Privacy & Content Filtering
- **Bug**: "Hide Adult Content" filter is non-functional. Adult content still appears in trending and search even when enabled.
- **Root Cause**: The `isAdult: false` parameter was hardcoded in `anilist.ts` but the store state wasn't being passed into the API calls dynamically.
- **Solution**: Update the API wrapper to accept a `hideAdult` flag and pass it from the `useQuery` hooks in components.
- **Location**: `src/lib/api/anilist.ts`, `src/lib/api/hybrid.ts`.

## 3. Playback & Media
- **Bug**: 404 Error when attempting to play content via `vidfast.pro`.
- **Solution**: Update `servers.json` to prioritize stable mirrors like `vidsrc.me` or `embed.su`.
- **Bug**: Episode thumbnails in the sidebar display generic posters instead of scene previews.
- **Root Cause**: Jikan's `/episodes` endpoint doesn't return thumbnails. These must be fetched from the `/episodes/videos` endpoint.
- **Solution**: Implement a "Thumbnail Resolver" in `hybrid.ts` that merges data from both Jikan endpoints.

## 4. History System
- **Bug**: History deduplication is failing; multiple entries for the same series appear in "Jump Back In".
- **Solution**: Harden the `addToHistory` logic in `userStore.ts` to strictly filter by `mediaId` (normalized) before prepending the new entry.

## 5. UI & UX Improvements
- **Settings Page**: "Interface" and "Privacy" tabs are currently blank.
- **Action**: Move content filtering to the Privacy tab and add interface customization (theme, primary color) to the Interface tab.
- **Hydration Mismatch**: Detected on `<body>` className due to theme-switching logic.
- **Action**: Use a `useEffect` to apply theme classes on the client-side only.

## 6. Community Section
- **Bug**: Commenter profile images are broken or generic.
- **Action**: Update the comment mapping to use AniList's user avatar URLs instead of hardcoded character images.
