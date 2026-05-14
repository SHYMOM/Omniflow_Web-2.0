'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, RefreshCw, ArrowUpDown, LayoutList, Bell } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface EpisodeSidebarProps {
  mediaId: number;
  mediaType: string;
  currentEp: number;
  malId: number;
  totalEpisodes: number;
  title: string;
}

// Mock episode dataset generator to populate premium thumbnail interfaces
const EPISODE_TITLES = [
  "I'm Luffy! The Man Who's Gonna Be King of the Pirates!",
  "Enter the Great Swordsman! Pirate Hunter Roronoa Zoro!",
  "Morgan versus Luffy! Who's the Mysterious Beautiful Girl?",
  "Luffy's Past! The Red-Haired Shanks Appears!",
  "A Terrifying Mysterious Power! Captain Buggy the Clown Pirate!",
  "Desperate Situation! Beast Tamer Mohji vs. Luffy!",
  "Grand Clash! Swordsman Zoro vs. Acrobat Cabaji!",
  "Who is the Victor? Devil Fruit Power Showdown!",
  "The Honorable Liar? Captain Usopp!",
  "The Weirdest Guy Ever! Jango the Hypnotist!",
];

const MOCK_THUMBS = [
  'https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg',
  'https://s4.anilist.co/file/anilistcdn/media/anime/banner/101922-YfZhKBUDDS6L.jpg',
  'https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQBSkxWAAk83.jpg',
  'https://s4.anilist.co/file/anilistcdn/media/anime/banner/1535-1x11vWqQWv68.jpg',
];

const MORE_LIKE_THIS = [
  {
    id: 1,
    title: 'MONSTERS: 103 Mercies Dragon Damnation',
    type: 'ONA',
    season: 'WINTER 2024',
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx166882-sQ5iZ848Gk4n.jpg',
    tag: 'PREQUEL',
  },
  {
    id: 2,
    title: 'One Piece: Defeat the Pirate Ganzack!',
    type: 'OVA',
    season: 'SUMMER 1998',
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2385-u23wS8Wz8x7v.png',
    tag: 'SIDE STORY',
  },
  {
    id: 3,
    title: 'One Piece: Umi no Heso no Daibouken',
    type: 'SPECIAL',
    season: 'FALL 2000',
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx2386-b4p5Xv98x41v.png',
    tag: 'SIDE STORY',
  },
  {
    id: 4,
    title: 'ONE PIECE: The Movie',
    type: 'MOVIE',
    season: 'WINTER 2000',
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx464-m4p5Xv98x41v.png',
    tag: 'SIDE STORY',
  },
  {
    id: 5,
    title: 'One Piece: Clockwork Island Adventure',
    type: 'MOVIE',
    season: 'SPRING 2001',
    poster: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx465-m4p5Xv98x41v.png',
    tag: 'SIDE STORY',
  },
];

export default function EpisodeSidebar({ mediaId, mediaType, currentEp, totalEpisodes, title }: EpisodeSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDesc, setIsDesc] = useState(false);

  // Generate robust episode array up to total or 24 default
  const episodesList = useMemo(() => {
    const count = totalEpisodes > 0 ? totalEpisodes : 24;
    return Array.from({ length: count }, (_, i) => {
      const epNum = i + 1;
      const epTitle = EPISODE_TITLES[i % EPISODE_TITLES.length];
      const thumb = MOCK_THUMBS[i % MOCK_THUMBS.length];
      // Generate deterministic mock views and years
      const views = Math.floor(480 - (i * 12)) + 'K views';
      const yearsAgo = Math.min(27, Math.max(1, 27 - Math.floor(i / 40))) + ' years ago';
      return { epNum, epTitle, thumb, views, yearsAgo };
    });
  }, [totalEpisodes]);

  // Apply search query filter and order reverse toggle
  const filteredEpisodes = useMemo(() => {
    let list = episodesList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        ep =>
          ep.epTitle.toLowerCase().includes(q) ||
          `episode ${ep.epNum}`.includes(q) ||
          `${ep.epNum}` === q
      );
    }
    return isDesc ? [...list].reverse() : list;
  }, [episodesList, searchQuery, isDesc]);

  // Compute Up Next target title string
  const nextEpObj = episodesList.find(e => e.epNum === currentEp + 1) || episodesList[0];

  return (
    <div className="w-full lg:w-[360px] shrink-0 space-y-4">
      {/* Up Next & Episodes Portal Box */}
      <div className="bg-void rounded-xl border border-border overflow-hidden shadow-lg">
        {/* Top Header String Info */}
        <div className="p-3.5 bg-surface/40 border-b border-border flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              Up Next - {nextEpObj?.epTitle || `Episode ${currentEp + 1}`}
            </p>
            <p className="text-[11px] text-text-muted truncate mt-0.5 font-medium">
              Playing - Episode {currentEp} - {title || 'Stream'}
            </p>
          </div>
          <button className="text-text-muted hover:text-white transition-colors cursor-pointer shrink-0 ml-2">
            <span className="text-xs">▲</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 bg-surface/20 border-b border-border flex items-center gap-2">
          {/* Internal search filter */}
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Episode"
              className="w-full bg-void border border-border/80 rounded-md pl-7 pr-2 py-1.5 text-xs text-white placeholder:text-text-muted outline-none focus:border-accent-green transition-colors"
            />
          </div>

          {/* Auxiliary action triggers */}
          <button
            onClick={() => setSearchQuery('')}
            className="w-7 h-7 rounded-md bg-void border border-border flex items-center justify-center text-text-secondary hover:text-white hover:bg-surface transition-colors cursor-pointer shrink-0"
            title="Reset Filters"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => setIsDesc(!isDesc)}
            className={cn(
              "w-7 h-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0",
              isDesc ? "bg-accent-green/20 border-accent-green text-accent-green" : "bg-void border-border text-text-secondary hover:text-white hover:bg-surface"
            )}
            title="Sort List Direction"
          >
            <ArrowUpDown size={13} />
          </button>
          <button
            className="w-7 h-7 rounded-md bg-void border border-border flex items-center justify-center text-text-secondary hover:text-white hover:bg-surface transition-colors cursor-pointer shrink-0"
            title="Toggle Visual Density Layout"
          >
            <LayoutList size={13} />
          </button>
        </div>

        {/* Episode Stream Scroller */}
        <div className="max-h-[380px] overflow-y-auto hide-scrollbar divide-y divide-border/30">
          {filteredEpisodes.map((ep) => {
            const isPlaying = ep.epNum === currentEp;

            return (
              <Link
                key={ep.epNum}
                href={`/watch?id=${mediaId}&type=${mediaType}&ep=${ep.epNum}`}
                className={cn(
                  'flex gap-3 p-2.5 transition-all items-start group relative',
                  isPlaying
                    ? 'bg-white/10 border-l-2 border-accent-green'
                    : 'hover:bg-surface/50'
                )}
              >
                {/* Thumbnail image with embedded Ep tag capsule */}
                <div className="relative w-[110px] aspect-video rounded-md overflow-hidden bg-surface shrink-0 border border-white/5 group-hover:border-accent-green/40 transition-colors">
                  <Image src={ep.thumb} alt={ep.epTitle} fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />

                  {/* Absolute Bottom-Left Tag Capsule */}
                  <span className="absolute bottom-1 left-1 bg-void/90 backdrop-blur-sm text-white font-bold text-[10px] px-1.5 py-0.5 rounded border border-white/10">
                    Ep {ep.epNum}
                  </span>
                </div>

                {/* Right text stack */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-xs font-bold line-clamp-2 leading-snug transition-colors",
                    isPlaying ? "text-accent-green" : "text-white group-hover:text-accent-green"
                  )}>
                    {ep.epTitle}
                  </p>
                  <p className="text-[10px] text-text-muted mt-1 font-medium">
                    {ep.views} • {ep.yearsAgo}
                  </p>
                </div>
              </Link>
            );
          })}

          {filteredEpisodes.length === 0 && (
            <p className="text-center text-xs text-text-muted py-10">No broadcast entries match query</p>
          )}
        </div>

        {/* Countdown Alert Strip Bottom */}
        <div className="p-2.5 bg-void border-t border-border flex items-center justify-center gap-1.5 text-center">
          <Bell size={12} className="text-text-muted" />
          <span className="text-xs font-bold text-text-secondary">Next ep airing</span>
          <span className="text-xs font-bold text-accent-green">in 4 days</span>
        </div>
      </div>

      {/* More Like This Component Block */}
      <div className="bg-void rounded-xl border border-border p-3.5 shadow-lg">
        <h3 className="text-sm font-bold text-white mb-3">More like this</h3>
        
        <div className="space-y-2.5">
          {MORE_LIKE_THIS.map((item) => (
            <Link
              key={item.id}
              href={`/anime/1`} // Target demo redirect path
              className="flex items-center gap-3 bg-surface/30 hover:bg-surface p-2 rounded-lg border border-border/40 hover:border-accent-green/30 transition-colors group"
            >
              {/* Vertical poster left */}
              <div className="relative w-12 h-16 rounded md overflow-hidden bg-surface shrink-0 border border-white/5">
                <Image src={item.poster} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform" />
              </div>

              {/* Stack metadata right */}
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-bold text-text-muted tracking-wider uppercase block">
                  {item.tag}
                </span>
                <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-accent-green transition-colors mt-0.5">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-text-secondary mt-1 font-medium">
                  <span>{item.type}</span>
                  <span>{item.season}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
