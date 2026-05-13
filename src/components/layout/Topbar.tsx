'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Search, Bell, LogIn, User } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils/cn';

export default function Topbar() {
  const pathname = usePathname();
  const { toggleSidebar, setSearchModalOpen, setAuthModalOpen } = useUIStore();
  const { user } = useUserStore();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-void/95 backdrop-blur-md border-b border-border z-50 flex items-center px-4 gap-3">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 rounded-lg hover:bg-surface transition-colors text-text-secondary hover:text-white"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
        <span className="font-display text-lg font-bold tracking-[2px] text-white">
          OMNISTREAM
        </span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search Bar */}
      <div
        className={cn(
          'hidden sm:flex items-center gap-2 bg-surface border rounded-lg px-3 py-2 transition-all max-w-[400px] w-full',
          searchFocused ? 'border-accent-green' : 'border-border'
        )}
      >
        <Search size={16} className="text-text-muted shrink-0" />
        <input
          type="text"
          placeholder="Search..."
          className="bg-transparent text-sm text-white placeholder:text-text-muted outline-none w-full"
          onFocus={() => {
            setSearchFocused(true);
            setSearchModalOpen(true);
          }}
          onBlur={() => setSearchFocused(false)}
          readOnly
        />
        <kbd className="hidden md:inline text-[10px] text-text-muted bg-void px-1.5 py-0.5 rounded border border-border">
          ⌘K
        </kbd>
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
        <Link
          href="/profile"
          className={cn(
            'w-8 h-8 rounded-full bg-accent-green/20 border border-accent-green/50 flex items-center justify-center text-accent-green text-sm font-semibold',
            pathname === '/profile' && 'ring-2 ring-accent-green'
          )}
        >
          {user.username.charAt(0).toUpperCase()}
        </Link>
      ) : (
        <button
          onClick={() => setAuthModalOpen(true)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-surface"
        >
          <LogIn size={16} />
          <span className="hidden md:inline">Sign In</span>
        </button>
      )}
    </header>
  );
}
