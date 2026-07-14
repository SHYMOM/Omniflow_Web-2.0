# Graph Report - .  (2026-07-15)

## Corpus Check
- 356 files · ~175,683 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1693 nodes · 4301 edges · 128 communities (58 shown, 70 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Manga Providers
- Movie & Drama Providers
- Anime Providers
- Stream Resolution Pipeline
- Anilist Meta Provider
- UI Components & Display
- Core App Pages & Auth
- TMDB & Hybrid API
- Jikan & External API Routes
- Home & Media Listing Pages
- Detail Components & Media Types
- VidNest Extraction Provider
- Extraction Utilities & Books
- Video Player & Episode UI
- TypeScript Configuration
- CinePro & Embed Aggregation
- Zoro Anime Provider
- Supabase Postgres Docs
- Subtitle Service
- Stream Video Extractors
- Base Provider Framework
- Manga Reader & Aggregator
- Extraction Infrastructure
- Circuit Breaker & Registry
- Movie Extraction & Stremio
- Runtime Dependencies
- Server Switcher & File Host
- Desi Extraction & String Match
- Cache & Core Extraction
- Manga API & Extraction Service
- Jikan API Library
- StreamHub & Smashy Extractors
- Supabase RLS & Security Docs
- Dev Dependencies & Build
- ComicK Manga Provider
- Light Novel Providers
- Anime Extraction Service
- Stream Proxy & Stealth Client
- GogoAnime Provider
- FileMoon & Abyss Extractors
- MegaCloud & VizCloud Extractors
- Comic Parser & LibGen
- VidAPI & User Agent Utils
- Package Scripts & Config
- DramaCool Provider
- FlixHQ Provider
- Goku Provider
- MovieHDWatch Provider
- MangaDex Provider
- ReadManga Provider
- FMovies Provider
- Rate Limiter
- 9Anime Provider
- AnimeDrive Provider
- TMDB Meta Provider
- JS Unpacker Utility
- MangaSee123 Provider
- Download Modal Component
- GogoCDN Extractor
- Rabbit & VidCloud Extractors
- StreamSB Extractor
- Proxy Model
- AnimeFox Provider
- AnimePahe Provider
- MonosChinos Provider
- ReadLightNovels Provider
- VyyManga Provider
- Supabase Schema Docs
- AnimeSaturn Provider
- AnimeUnity Provider
- AniWatchX Provider
- KickAssAnime Provider
- LmAnime Donghua Provider
- AsiaFlix Drama Provider
- KDramaSmaza Provider
- NovelUpdates Provider
- AsuraScans Provider
- MangaHere Provider
- Flixer Provider
- SmashyStream Movie Provider
- ID Sync Service
- MangaUpdates API
- AsianLoad Extractor
- DoodStream Extractor
- React Query Client
- Ultimate Aggregator
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 124
- Community 125
- Community 126

## God Nodes (most connected - your core abstractions)
1. `ISearch` - 81 edges
2. `IVideo` - 58 edges
3. `IEpisodeServer` - 52 edges
4. `ISource` - 52 edges
5. `AnimeParser` - 51 edges
6. `useUserStore` - 49 edges
7. `IAnimeResult` - 48 edges
8. `VideoExtractor` - 46 edges
9. `cn()` - 46 edges
10. `MovieParser` - 43 edges

## Surprising Connections (you probably didn't know these)
- `AdsManager()` --calls--> `searchHybrid()`  [EXTRACTED]
  src/components/admin/AdsManager.tsx → src/lib/api/hybrid.ts
- `OverviewTabProps` --references--> `MediaItem`  [EXTRACTED]
  src/components/details/OverviewTab.tsx → src/types/media.ts
- `HoverCardProps` --references--> `MediaItem`  [EXTRACTED]
  src/components/media/HoverCard.tsx → src/types/media.ts
- `EpisodeSidebar()` --calls--> `cn()`  [EXTRACTED]
  src/components/player/EpisodeSidebar.tsx → src/lib/utils/cn.ts
- `getRecentlyUpdatedAnime()` --indirect_call--> `s()`  [INFERRED]
  src/lib/api/anilist.ts → src/lib/consumet/providers/comics/getComics.ts

## Import Cycles
- 3-file cycle: `src/lib/consumet/extractors/gogocdn.ts -> src/lib/consumet/utils/index.ts -> src/lib/consumet/extractors/index.ts -> src/lib/consumet/extractors/gogocdn.ts`
- 3-file cycle: `src/lib/consumet/extractors/index.ts -> src/lib/consumet/extractors/streamwish.ts -> src/lib/consumet/utils/index.ts -> src/lib/consumet/extractors/index.ts`
- 3-file cycle: `src/lib/consumet/extractors/index.ts -> src/lib/consumet/extractors/rapidcloud.ts -> src/lib/consumet/utils/index.ts -> src/lib/consumet/extractors/index.ts`
- 3-file cycle: `src/lib/consumet/extractors/index.ts -> src/lib/consumet/extractors/streamsb.ts -> src/lib/consumet/utils/index.ts -> src/lib/consumet/extractors/index.ts`
- 3-file cycle: `src/lib/consumet/extractors/index.ts -> src/lib/consumet/extractors/vidcloud.ts -> src/lib/consumet/utils/index.ts -> src/lib/consumet/extractors/index.ts`

## Hyperedges (group relationships)
- **Query Performance Rules** — agents_skills_supabase_postgres_best_practices_references_query_composite_indexes_compositeindexes, agents_skills_supabase_postgres_best_practices_references_query_covering_indexes_coveringindexes, agents_skills_supabase_postgres_best_practices_references_query_index_types_indextypes [EXTRACTED 1.00]
- **Connection Management Rules** — agents_skills_supabase_postgres_best_practices_references_conn_idle_timeout_idleconnectiontimeouts, agents_skills_supabase_postgres_best_practices_references_conn_limits_connectionlimits, agents_skills_supabase_postgres_best_practices_references_conn_pooling_connectionpooling, agents_skills_supabase_postgres_best_practices_references_conn_prepared_statements_preparedstatements [EXTRACTED 1.00]
- **Concurrency and Locking Rules** — agents_skills_supabase_postgres_best_practices_references_lock_advisory_advisorylocks, agents_skills_supabase_postgres_best_practices_references_lock_deadlock_prevention_deadlockprevention, agents_skills_supabase_postgres_best_practices_references_lock_short_transactions_shorttransactions, agents_skills_supabase_postgres_best_practices_references_lock_skip_locked_skiplocked [EXTRACTED 1.00]
- **Data Access Pattern Rules** — agents_skills_supabase_postgres_best_practices_references_data_batch_inserts_batchinserts, agents_skills_supabase_postgres_best_practices_references_data_n_plus_one_eliminatenplusone, agents_skills_supabase_postgres_best_practices_references_data_pagination_cursorbasedpagination, agents_skills_supabase_postgres_best_practices_references_data_upsert_upsert [EXTRACTED 1.00]
- **Monitoring and Diagnostics Rules** — agents_skills_supabase_postgres_best_practices_references_monitor_explain_analyze_explainanalyze, agents_skills_supabase_postgres_best_practices_references_monitor_pg_stat_statements_pgstatstatements, agents_skills_supabase_postgres_best_practices_references_monitor_vacuum_analyze_vacuumandanalyze [EXTRACTED 1.00]
- **Advanced Feature Rules** — agents_skills_supabase_postgres_best_practices_references_advanced_full_text_search_tsvectorfulltextsearch, agents_skills_supabase_postgres_best_practices_references_advanced_jsonb_indexing_jsonbindexing [EXTRACTED 1.00]
- **Index Optimization Techniques** — agents_skills_supabase_postgres_best_practices_references_query_composite_indexes_compositeindexes, agents_skills_supabase_postgres_best_practices_references_query_covering_indexes_coveringindexes, agents_skills_supabase_postgres_best_practices_references_query_index_types_indextypes, agents_skills_supabase_postgres_best_practices_references_advanced_jsonb_indexing_jsonbindexing, agents_skills_supabase_postgres_best_practices_references_advanced_full_text_search_tsvectorfulltextsearch [INFERRED 0.95]
- **Security and RLS (Critical)** — agents_skills_supabase_postgres_best_practices_references__sections_securityandrls [EXTRACTED 1.00]
- **Schema Design (High)** — agents_skills_supabase_postgres_best_practices_references__sections_schemadesign [EXTRACTED 1.00]
- **PostgreSQL Indexing Strategies** — _agents_skills_supabase_postgres_best_practices_references_query_missing_indexes_indexonwhereandjoincolumns, _agents_skills_supabase_postgres_best_practices_references_query_partial_indexes_partialindexes, _agents_skills_supabase_postgres_best_practices_references_schema_foreign_key_indexes_foreignkeyindexing [INFERRED 0.85]
- **RLS Security Architecture** — _agents_skills_supabase_postgres_best_practices_references_security_rls_basics_rowlevelsecurity, _agents_skills_supabase_postgres_best_practices_references_security_rls_basics_multitenantisolation, _agents_skills_supabase_postgres_best_practices_references_security_rls_performance_rlsoptimization, _agents_skills_supabase_postgres_best_practices_references_security_rls_performance_securitydefinerfunctions [INFERRED 0.85]
- **Framework Brand Logos** — public_next_nextlogo, public_vercel_vercellogo [INFERRED 0.95]
- **Default UI Icons** — public_file_fileicon, public_globe_globeicon, public_window_windowicon [INFERRED 0.85]

## Communities (128 total, 70 thin omitted)

### Community 0 - "Manga Providers"
Cohesion: 0.06
Nodes (35): MangaParser, ComicRes, FuzzyDate, Genres, IAnimeEpisodeV2, IAudioTrack, IMangaChapter, IMangaChapterPage (+27 more)

### Community 1 - "Movie & Drama Providers"
Cohesion: 0.09
Nodes (17): MixDrop, StreamTape, MovieParser, IEpisodeServer, IMovieEpisode, IMovieInfo, IMovieResult, ISource (+9 more)

### Community 2 - "Anime Providers"
Cohesion: 0.10
Nodes (18): AnimeParser, IAnimeEpisode, IAnimeInfo, ISearch, MediaFormat, MediaStatus, SubOrSub, ProviderId (+10 more)

### Community 3 - "Stream Resolution Pipeline"
Cohesion: 0.06
Nodes (30): GET(), StreamPayload, StreamSource, SubtitleSource, universalAggregator, formatStreamUrls(), normalizeLanguage(), universalAggregator (+22 more)

### Community 4 - "Anilist Meta Provider"
Cohesion: 0.06
Nodes (18): Topics, Anilist, Myanimelist, AnimeNewsNetwork, NewsFeed, scrapNewsInfo(), anilistAdvancedQuery(), anilistCharacterQuery() (+10 more)

### Community 5 - "UI Components & Display"
Cohesion: 0.07
Nodes (32): HistoryPage(), SettingsPage(), SettingSwitch(), STATUS_TABS, WatchlistPage(), DetailHeader(), OverviewTab(), OverviewTabProps (+24 more)

### Community 6 - "Core App Pages & Auth"
Cohesion: 0.08
Nodes (33): AdminPage(), supabase, DiscoverPage(), GENRES, YEARS, inter, metadata, ProfilePage() (+25 more)

### Community 7 - "TMDB & Hybrid API"
Cohesion: 0.08
Nodes (35): MovieDetailPage(), TABS, TrendingPage(), DAY_LABELS, DAYS, ScheduleWidget(), getAiringSchedule(), queryAniList() (+27 more)

### Community 8 - "Jikan & External API Routes"
Cohesion: 0.06
Nodes (18): GET(), GET(), GET(), GET(), GET(), GET(), GET(), POST() (+10 more)

### Community 9 - "Home & Media Listing Pages"
Cohesion: 0.12
Nodes (32): AnimeDetailPage(), TABS, HomePage(), PopularPage(), SeasonPage(), TopRatedPage(), UpcomingPage(), CommentType (+24 more)

### Community 10 - "Detail Components & Media Types"
Cohesion: 0.10
Nodes (26): CharactersTabProps, DetailHeaderProps, EpisodesTabProps, MoreLikeThisTabProps, RelatedTabProps, HeroBannerProps, TopUpcomingProps, TrendingRowProps (+18 more)

### Community 11 - "VidNest Extraction Provider"
Cohesion: 0.09
Nodes (24): decodeVidnestBase64(), decrypt(), VIDNEST_REVERSE_MAP, allmoviesResponse, Caption, deltaResponse, deltaStream, encryptedResponse (+16 more)

### Community 12 - "Extraction Utilities & Books"
Cohesion: 0.11
Nodes (18): BilibiliExtractor, RapidCloud, BookParser, LibgenResult, Libgen, parsePostInfo(), anilistAiringScheduleQuery(), capitalizeFirstLetter() (+10 more)

### Community 13 - "Video Player & Episode UI"
Cohesion: 0.10
Nodes (22): TABS, TVDetailPage(), WatchContent(), EpisodesTab(), TVSeasonView(), TVSeasonViewProps, Episode, EpisodeSidebar() (+14 more)

### Community 14 - "TypeScript Configuration"
Cohesion: 0.06
Nodes (33): CND Example, consumet-consumet.ts, dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts (+25 more)

### Community 15 - "CinePro & Embed Aggregation"
Cohesion: 0.14
Nodes (13): GET(), AniSkipService, CineproAggregator, VidLinkProvider, EmbedProvider, EmbedProviderAggregator, PlayerState, IAudioTrack (+5 more)

### Community 17 - "Supabase Postgres Docs"
Cohesion: 0.20
Nodes (31): Writing Guidelines for Postgres References, Advanced Features (Low), Concurrency & Locking (Medium-High), Connection Management (Critical), Data Access Patterns (Medium), Monitoring & Diagnostics (Low-Medium), Query Performance (Critical), Schema Design (High) (+23 more)

### Community 18 - "Subtitle Service"
Cohesion: 0.14
Nodes (6): ALLOWED_LANGS, GET(), memoryCache, VidSrcProvider, SubtitleSearchParams, SubtitleService

### Community 19 - "Stream Video Extractors"
Cohesion: 0.15
Nodes (8): Kwik, Mp4Upload, StreamLare, extractStreamTape(), StreamWish, VidMoly, Voe, VideoExtractor

### Community 20 - "Base Provider Framework"
Cohesion: 0.11
Nodes (7): BaseParser, BaseProvider, LightNovelParser, NewsParser, IProviderStats, ProxyConfig, Anify

### Community 21 - "Manga Reader & Aggregator"
Cohesion: 0.16
Nodes (13): MangaDetailPage(), MangaReaderContent(), ReaderMode, fetchMangaChapterPagesAction(), fetchMangaChaptersAction(), getMangaDetail(), aggregateChapters(), aggregatePages() (+5 more)

### Community 22 - "Extraction Infrastructure"
Cohesion: 0.17
Nodes (16): CircuitEntry, CircuitState, ACCEPT_LANGUAGE_POOL, ANIME_PROVIDER_ORDER, CIRCUIT_BREAKER_CONFIG, DEFAULT_RATE_LIMIT, MANGA_PROVIDER_ORDER, MOVIE_PROVIDER_ORDER (+8 more)

### Community 23 - "Circuit Breaker & Registry"
Cohesion: 0.15
Nodes (5): CircuitBreaker, ProviderRegistry, ICircuitBreakerConfig, IProviderHealth, IProviderResult

### Community 24 - "Movie Extraction & Stremio"
Cohesion: 0.23
Nodes (3): MovieExtractionService, StremioExtractor, IStreamResult

### Community 25 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (21): ascii-url-encoder, axios, crypto-js, dotenv, framer-motion, hls.js, lucide-react, dependencies (+13 more)

### Community 26 - "Server Switcher & File Host"
Cohesion: 0.14
Nodes (9): ServerSwitcher(), ServerSwitcherProps, useHotSwap(), UseHotSwapProps, FileHostResolver, buildSyntheticM3U8(), usePlayerStore, Server (+1 more)

### Community 27 - "Desi Extraction & String Match"
Cohesion: 0.16
Nodes (13): getUniqueSubtitles(), VideoPlayer(), s(), DEFAULT_HEADERS, DesiDubAnimeExtractor, DEFAULT_CORS_HEADERS, HindiDubbedExtractor, disambiguateMedia() (+5 more)

### Community 28 - "Cache & Core Extraction"
Cohesion: 0.20
Nodes (9): getCachedStream(), globalForRedis, setCachedStream(), MovieboxExtractor, PlaywrightExtractor, ProviderEntry, ExtractionContext, MediaType (+1 more)

### Community 29 - "Manga API & Extraction Service"
Cohesion: 0.19
Nodes (7): GET(), mangaService, GET(), mangaService, MangaExtractionService, IMangaChapterListResult, IMangaPageResult

### Community 30 - "Jikan API Library"
Cohesion: 0.18
Nodes (13): getAnimeEpisodes(), getAnimeEpisodeVideos(), getTopAnime(), jikanFetchQueue, rateLimitedFetch(), JikanAnime, JikanCharacter, JikanEntity (+5 more)

### Community 31 - "StreamHub & Smashy Extractors"
Cohesion: 0.27
Nodes (5): Mp4Player, SmashyStream, StreamHub, ISubtitle, IVideo

### Community 32 - "Supabase RLS & Security Docs"
Cohesion: 0.15
Nodes (17): Skill Feedback Issue Template, Index on WHERE and JOIN Columns, Sequential Scan, Partial Indexes, Safe Constraint Migration, Foreign Key Indexing, Least Privilege Principle, Multi-Tenant Data Isolation (+9 more)

### Community 33 - "Dev Dependencies & Build"
Cohesion: 0.12
Nodes (17): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, @types/node (+9 more)

### Community 34 - "ComicK Manga Provider"
Cohesion: 0.17
Nodes (10): ChapterData, Comic, ComicCategories, ComicGenres, ComicK, ComicLinks, ComicTitles, Cover (+2 more)

### Community 35 - "Light Novel Providers"
Cohesion: 0.22
Nodes (5): ILightNovelChapter, ILightNovelChapterContent, ILightNovelInfo, ILightNovelResult, PROVIDERS_LIST

### Community 37 - "Stream Proxy & Stealth Client"
Cohesion: 0.23
Nodes (5): corsHeaders, GET(), stealthClient, StealthHttpClient, IStealthRequestConfig

### Community 39 - "FileMoon & Abyss Extractors"
Cohesion: 0.24
Nodes (8): extractFileMoon(), Filemoon, extractMixDrop(), determineType(), extractCyberlockerMedia(), ExtractorResult, detectAndUnpack(), intToBase()

### Community 40 - "MegaCloud & VizCloud Extractors"
Cohesion: 0.19
Nodes (6): apiFormat, megacloud, tracks, unencrypSources, VizCloud, Intro

### Community 41 - "Comic Parser & LibGen"
Cohesion: 0.24
Nodes (9): Book, Hashes, ComicParser, GetComicsComicsObject, HashesObject, LibgenBookObject, GetComicsComics, LibgenBook (+1 more)

### Community 42 - "VidAPI & User Agent Utils"
Cohesion: 0.22
Nodes (6): generateRandomUserAgent(), getRandomElement(), Data, DefaultSub, VidApiResponse, VidApiProvider

### Community 43 - "Package Scripts & Config"
Cohesion: 0.17
Nodes (11): name, optionalDependencies, playwright, private, scripts, build, dev, lint (+3 more)

### Community 57 - "Download Modal Component"
Cohesion: 0.33
Nodes (4): DownloadModalProps, HlsAudioTrack, HlsQualityLevel, StreamSubtitle

### Community 59 - "Rabbit & VidCloud Extractors"
Cohesion: 0.47
Nodes (3): data, main(), VidCloud

### Community 67 - "Supabase Schema Docs"
Cohesion: 0.40
Nodes (5): Appropriate Data Types, Lowercase Identifier Convention, Table Partitioning, Primary Key Strategy, UUIDv7

### Community 84 - "React Query Client"
Cohesion: 0.83
Nodes (3): getQueryClient(), makeQueryClient(), QueryProvider()

## Knowledge Gaps
- **231 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `private` (+226 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **70 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getMediaEpisodes()` connect `Video Player & Episode UI` to `Home & Media Listing Pages`, `Light Novel Providers`, `Manga Reader & Aggregator`, `TMDB & Hybrid API`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `StreamingServers` connect `Movie & Drama Providers` to `Manga Providers`, `Anime Providers`, `Light Novel Providers`, `DramaCool Provider`, `Goku Provider`, `MovieHDWatch Provider`, `Cache & Core Extraction`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `IStreamSubtitle` connect `CinePro & Embed Aggregation` to `Subtitle Service`, `Cache & Core Extraction`, `Extraction Infrastructure`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `name` to the rest of the system?**
  _231 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Manga Providers` be split into smaller, more focused modules?**
  _Cohesion score 0.062037037037037036 - nodes in this community are weakly interconnected._
- **Should `Movie & Drama Providers` be split into smaller, more focused modules?**
  _Cohesion score 0.09249786871270248 - nodes in this community are weakly interconnected._
- **Should `Anime Providers` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._