'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Calendar, Clock, Film, Tv, Clapperboard, BookOpen, ListVideo, Settings, X, ShieldAlert } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils/cn';

const mainLinks = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Search },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/history', label: 'Watch History', icon: Clock },
];

const categoryLinks = [
  { href: '/movies', label: 'Movies', icon: Film },
  { href: '/tv', label: 'TV Shows', icon: Tv },
  { href: '/anime', label: 'Anime', icon: Clapperboard },
  { href: '/manga', label: 'Manga', icon: BookOpen },
];

const accountLinks = [
  { href: '/watchlist', label: 'My List', icon: ListVideo },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { user } = useUserStore();
  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          'fixed top-14 left-0 bottom-0 w-60 bg-void border-r border-border z-40 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          'overflow-y-auto hide-scrollbar',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button (mobile) */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-3 right-3 p-1 rounded-lg hover:bg-surface text-text-secondary hover:text-white"
        >
          <X size={18} />
        </button>

        {/* Main section */}
        <nav className="p-3 pt-4">
          <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold px-3 mb-2">
            Main
          </p>
          {mainLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5',
                pathname === link.href
                  ? 'bg-surface text-white font-medium'
                  : 'text-text-secondary hover:bg-surface hover:text-white'
              )}
            >
              <link.icon size={18} />
              {link.label}
              {pathname === link.href && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-green" />
              )}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-border" />

        {/* Categories section */}
        <nav className="p-3">
          <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold px-3 mb-2">
            Categories
          </p>
          {categoryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5',
                pathname === link.href
                  ? 'bg-surface text-white font-medium'
                  : 'text-text-secondary hover:bg-surface hover:text-white'
              )}
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-border" />

        {/* Account section */}
        <nav className="p-3">
          <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold px-3 mb-2">
            Account
          </p>
          {accountLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5',
                pathname === link.href
                  ? 'bg-surface text-white font-medium'
                  : 'text-text-secondary hover:bg-surface hover:text-white'
              )}
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mb-0.5 mt-2',
                pathname === '/admin'
                  ? 'bg-surface text-white font-medium text-accent-green'
                  : 'text-text-secondary hover:bg-surface hover:text-white hover:text-accent-green'
              )}
            >
              <ShieldAlert size={18} className={pathname === '/admin' ? "text-accent-green" : ""} />
              Admin Panel
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="mt-auto p-3 border-t border-border">
          <p className="text-[10px] text-text-muted text-center">
            OMNISTREAM © {new Date().getFullYear()}
          </p>
        </div>
      </aside>
    </>
  );
}
