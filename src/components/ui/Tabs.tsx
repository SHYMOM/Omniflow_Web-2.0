'use client';

import { cn } from '@/lib/utils/cn';

interface TabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
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
          {tab}
          {activeTab === tab && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}
