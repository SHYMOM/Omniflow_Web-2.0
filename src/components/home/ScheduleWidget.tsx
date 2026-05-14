'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock } from 'lucide-react';
import { getSchedule } from '@/lib/api/jikan';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleWidget() {
  const today = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(DAYS[today]);

  const { data: scheduleItems, isLoading } = useQuery({
    queryKey: ['schedule', selectedDay],
    queryFn: () => getSchedule(selectedDay),
    staleTime: 30 * 60 * 1000,
  });

  // Generate day tabs for the current week
  const dayTabs = useMemo(() => {
    const now = new Date();
    return DAYS.map((day, i) => {
      const diff = i - today;
      const date = new Date(now);
      date.setDate(date.getDate() + diff);
      return {
        key: day,
        label: DAY_LABELS[i],
        dateStr: `${date.getMonth() + 1}/${date.getDate()}`,
        isToday: i === today,
      };
    });
  }, [today]);

  return (
    <section className="bg-surface rounded-xl p-4 border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-white">Estimated Schedule</h3>
        <Link href="/schedule" className="text-text-secondary hover:text-white">
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto hide-scrollbar">
        {dayTabs.map(({ key, label, dateStr, isToday }) => (
          <button
            key={key}
            onClick={() => setSelectedDay(key)}
            className={`shrink-0 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
              selectedDay === key
                ? 'bg-white text-black'
                : 'bg-transparent text-text-secondary hover:text-white'
            }`}
          >
            {label} {dateStr}
            {isToday && selectedDay !== key && <span className="ml-0.5 text-accent-green">*</span>}
          </button>
        ))}
      </div>

      {/* Schedule list */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto hide-scrollbar">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2 animate-pulse">
              <div className="w-[45px] h-4 rounded skeleton" />
              <div className="flex-1 h-4 rounded skeleton" />
              <div className="w-10 h-4 rounded skeleton" />
            </div>
          ))
        ) : scheduleItems && scheduleItems.length > 0 ? (
          (() => {
            const seen = new Set();
            return scheduleItems.slice(0, 20).map((item) => {
              if (seen.has(item.mal_id)) return null;
              seen.add(item.mal_id);
              
              return (
                <Link
                  key={item.mal_id}
                  href={`/anime/mal-${item.mal_id}`} // Use mal- prefix for Jikan/MAL IDs
                  className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-surface-hover transition-colors group"
                >
                  <span className="text-text-muted text-[13px] w-[45px] shrink-0 flex items-center gap-1">
                    <Clock size={10} />
                    {item.broadcast?.time || '??:??'}
                  </span>
                  <span className="text-[13px] text-white flex-1 line-clamp-1 group-hover:text-accent-green transition-colors">
                    {item.title}
                  </span>
                  {item.episodes && (
                    <span className="text-[12px] text-text-secondary bg-void px-1.5 py-0.5 rounded shrink-0">
                      Ep {item.episodes}
                    </span>
                  )}
                </Link>
              );
            });
          })()
        ) : (
          <p className="text-text-muted text-sm text-center py-4">No shows scheduled</p>
        )}
      </div>
    </section>
  );
}
