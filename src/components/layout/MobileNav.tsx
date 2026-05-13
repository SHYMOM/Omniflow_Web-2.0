'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, Search, ListVideo, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/search', label: 'Browse', icon: Search },
  { href: '/watchlist', label: 'My List', icon: ListVideo },
  { href: '/profile', label: 'You', icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/95 backdrop-blur-md border-t border-border z-50 flex items-center justify-around px-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[56px]',
              isActive ? 'text-white' : 'text-text-muted'
            )}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
            {isActive && (
              <div className="absolute bottom-1 w-1 h-1 rounded-full bg-accent-green" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
