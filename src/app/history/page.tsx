'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Pause, Play, MoreVertical } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { formatRelativeTime } from '@/lib/utils/formatters';

export default function HistoryPage() {
  const { history, removeFromHistory, clearHistory, historyPaused, toggleHistoryPause } = useUserStore();

  // Group by date
  const grouped = history.reduce<Record<string, typeof history>>((acc, entry) => {
    const date = new Date(entry.watchedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: History list */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white mb-6">Watch History</h1>

          {history.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-text-muted text-lg mb-2">No watch history yet</p>
              <p className="text-text-muted text-sm">Start watching something to see it here.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([date, entries]) => (
              <div key={date} className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">{date}</h3>
                <div className="space-y-2">
                  {entries.map((entry) => (
                    <div key={`${entry.mediaId}-${entry.episodeNumber}`} className="flex items-center gap-3 bg-surface/50 hover:bg-surface rounded-lg p-2 group">
                      <Link href={`/watch?id=${entry.mediaId}&type=${entry.mediaType}&ep=${entry.episodeNumber}`} className="relative w-[180px] h-[100px] rounded-lg overflow-hidden bg-surface shrink-0">
                        {entry.thumbnailUrl && <Image src={entry.thumbnailUrl} alt="" fill className="object-cover" />}
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/20">
                          <div className="h-full bg-accent-green" style={{ width: `${entry.progress * 100}%` }} />
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-white line-clamp-1">{entry.episodeTitle}</p>
                        <p className="text-sm text-text-secondary">{entry.mediaTitle}</p>
                        <p className="text-xs text-text-muted">{formatRelativeTime(entry.watchedAt)}</p>
                      </div>
                      <button onClick={() => removeFromHistory(entry.mediaId, entry.episodeNumber)} className="p-2 text-text-muted hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Controls */}
        <div className="lg:w-[250px] shrink-0 space-y-3">
          <button onClick={toggleHistoryPause} className="flex items-center gap-2 text-sm text-white w-full px-4 py-2.5 rounded-lg hover:bg-surface transition-colors">
            {historyPaused ? <Play size={16} /> : <Pause size={16} />}
            {historyPaused ? 'Resume watch history' : 'Pause watch history'}
          </button>
          <button onClick={clearHistory} className="flex items-center gap-2 text-sm text-accent-red w-full px-4 py-2.5 rounded-lg hover:bg-surface transition-colors">
            <Trash2 size={16} /> Clear watch history
          </button>
        </div>
      </div>
    </div>
  );
}
