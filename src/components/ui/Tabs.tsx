'use client';

import { cn } from '@/lib/utils/cn';

interface TabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
  icons?: Record<string, React.ReactNode>;
}

export default function Tabs({ 
  tabs, 
  activeTab, 
  onTabChange, 
  className,
  variant = 'underline',
  icons
}: TabsProps) {
  if (variant === 'pills') {
    return (
      <div className={cn('grid grid-cols-3 gap-3 md:gap-4 w-full', className)}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                'flex items-center justify-center gap-2 py-1.5 md:py-2 text-xs md:text-sm font-semibold transition-all rounded-[6px] border whitespace-nowrap',
                isActive
                  ? 'bg-white text-black border-white shadow-[0_2px_8px_rgba(255,255,255,0.1)]'
                  : 'bg-[#121214]/65 hover:bg-[#18181b]/85 text-zinc-400 border-white/5 hover:text-white'
              )}
            >
              {icons && icons[tab] && (
                <span className={cn('flex items-center shrink-0', isActive ? 'text-black' : 'text-zinc-400')}>
                  {icons[tab]}
                </span>
              )}
              {tab}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex border-b border-border overflow-x-auto hide-scrollbar', className)}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            'px-6 py-2.5 text-sm font-medium whitespace-nowrap transition-all relative',
            activeTab === tab
              ? 'text-white'
              : 'text-text-secondary hover:text-white'
          )}
        >
          {icons && icons[tab] && (
            <span className="inline-flex items-center mr-2">
              {icons[tab]}
            </span>
          )}
          {tab}
          {activeTab === tab && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
