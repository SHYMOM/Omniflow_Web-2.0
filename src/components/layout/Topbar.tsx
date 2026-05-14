'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, Search, Bell, LogIn, User, Settings as SettingsIcon } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils/cn';

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar, setSearchModalOpen, setAuthModalOpen } = useUIStore();
  const { user } = useUserStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchModalOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-[100] flex items-center px-6 gap-3 pointer-events-none">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white pointer-events-auto"
        aria-label="Toggle sidebar"
      >
        <Menu size={22} />
      </button>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mr-4 shrink-0 pointer-events-auto">
        <span className="font-display text-xl font-bold tracking-[3px] text-white drop-shadow-lg">
          ANIMETSU
        </span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Glassy Search Bar */}
      <div
        className={cn(
          'hidden sm:flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-2 transition-all max-w-[400px] w-full pointer-events-auto',
          searchFocused ? 'bg-white/20 border-accent-green/50 ring-2 ring-accent-green/20' : 'hover:bg-white/15'
        )}
      >
        <button onClick={() => handleSearchSubmit()} className="text-white/60 hover:text-white transition-colors shrink-0">
          <Search size={18} />
        </button>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="bg-transparent text-sm text-white placeholder:text-white/40 outline-none w-full font-medium"
          onFocus={() => {
            setSearchFocused(true);
          }}
          onBlur={() => setSearchFocused(false)}
        />
        <button 
          onClick={() => setSearchModalOpen(true)}
          className="hidden md:inline text-[9px] font-black text-white/40 bg-black/40 px-1.5 py-0.5 rounded-md border border-white/5 hover:text-white transition-colors"
          title="Open advanced quick search"
        >
          ⌘K
        </button>
      </div>

      {/* Mobile search */}
      <button
        onClick={() => setSearchModalOpen(true)}
        className="sm:hidden p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-white"
        aria-label="Search"
      >
        <Search size={20} />
      </button>

      {/* Bell */}
      <button
        className="p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-white relative"
        aria-label="Notifications"
      >
        <Bell size={20} />
      </button>

      {/* Auth / User */}
      {user ? (
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className={cn(
              "p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-white",
              pathname === '/settings' && "text-accent-green bg-accent-green/10"
            )}
            title="Settings"
          >
            <SettingsIcon size={20} />
          </Link>
          <Link
            href="/profile"
            className={cn(
              'w-8 h-8 rounded-full bg-accent-green/20 border border-accent-green/50 flex items-center justify-center text-accent-green text-sm font-semibold',
              pathname === '/profile' && 'ring-2 ring-accent-green'
            )}
          >
            {user.username.charAt(0).toUpperCase()}
          </Link>
        </div>
      ) : (
        <button
          onClick={() => setAuthModalOpen(true)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-surface"
        >
          <LogIn size={16} />
          <span className="hidden md:inline">Sign in</span>
        </button>
      )}
    </header>
  );
}
