'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trash2, Pause, Play, Download, Upload, Search, X } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { formatRelativeTime } from '@/lib/utils/formatters';

export default function HistoryPage() {
  const { history, removeFromHistory, clearHistory, importHistory, historyPaused, toggleHistoryPause } = useUserStore();
  const [filterQuery, setFilterQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply real-time client text search filtering
  const filteredHistory = useMemo(() => {
    if (!filterQuery.trim()) return history;
    const q = filterQuery.toLowerCase();
    return history.filter(
      entry =>
        entry.mediaTitle.toLowerCase().includes(q) ||
        entry.episodeTitle?.toLowerCase().includes(q)
    );
  }, [history, filterQuery]);

  // Group filtered records by formatted date string
  const grouped = useMemo(() => {
    return filteredHistory.reduce<Record<string, typeof history>>((acc, entry) => {
      const date = new Date(entry.watchedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      if (!acc[date]) acc[date] = [];
      acc[date].push(entry);
      return acc;
    }, {});
  }, [filteredHistory]);

  // JSON database export pipeline
  const handleExport = () => {
    if (!history.length) return;
    const dataStr = JSON.stringify(history, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnistream_history_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // JSON database restore import pipeline
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          importHistory(parsed);
          alert(`Successfully restored ${parsed.length} watch history entries from JSON backup.`);
        } else {
          alert('Invalid backup structure format. Must be a valid JSON array.');
        }
      } catch (err) {
        alert('Failed to read or decode uploaded backup JSON database.');
      } finally {
        // Reset file input target
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 pt-20">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Main History Stream list */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white font-display">Watch History</h1>
              <p className="text-xs text-text-secondary mt-0.5">
                {historyPaused ? '⚠️ Tracking currently paused' : `Tracking last ${history.length} active multi-format stream playback records`}
              </p>
            </div>

            {/* Keyword Filter Search input */}
            <div className="relative w-full sm:w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                placeholder="Filter history records..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder:text-text-muted outline-none focus:border-accent-green transition-colors"
              />
              {filterQuery && (
                <button onClick={() => setFilterQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white cursor-pointer">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border rounded-xl bg-surface/30">
              <p className="text-text-muted text-sm mb-2 font-medium">
                {filterQuery ? 'No history records match your custom text filter' : 'Your cinematic playback history is currently empty'}
              </p>
              {!filterQuery && (
                <p className="text-text-muted text-xs max-w-sm mx-auto">
                  Stream progress automatically registers upon viewing episode channels or importing verified external backup payloads.
                </p>
              )}
            </div>
          ) : (
            Object.entries(grouped).map(([date, entries]) => (
              <div key={date} className="mb-6">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3 pb-1 border-b border-border/40">
                  {date}
                </h3>
                <div className="space-y-2.5">
                    {entries.map((entry) => {
                      const safeMediaTitle = typeof entry.mediaTitle === 'string' ? entry.mediaTitle : ((entry.mediaTitle as any)?.english || (entry.mediaTitle as any)?.romaji || 'Unknown Series');
                      const safeEpTitle = typeof entry.episodeTitle === 'string' ? entry.episodeTitle : 'Episode ' + entry.episodeNumber;

                      return (
                        <div
                          key={`${entry.mediaId}-${entry.episodeNumber}-${entry.watchedAt}`}
                          className="flex items-center gap-3 bg-surface/40 hover:bg-surface border border-border/40 rounded-lg p-2.5 group transition-colors"
                        >
                          {/* Video clip thumbnail wrapper */}
                          <Link
                            href={`/watch?id=${entry.mediaId}&type=${entry.mediaType}&ep=${entry.episodeNumber}`}
                            className="relative w-[140px] sm:w-[160px] aspect-video rounded-md overflow-hidden bg-void shrink-0 border border-white/5 group-hover:border-accent-green/40 transition-colors"
                          >
                            {entry.thumbnailUrl && (
                              <Image src={entry.thumbnailUrl} alt={safeMediaTitle} fill className="object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                            
                            {/* Stream progress bar tracking track */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                              <div className="h-full bg-accent-green" style={{ width: `${Math.min(100, Math.max(5, (entry.progress || 0) * 100))}%` }} />
                            </div>
                          </Link>

                          {/* Content strings */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/watch?id=${entry.mediaId}&type=${entry.mediaType}&ep=${entry.episodeNumber}`}
                              className="block text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-accent-green transition-colors"
                            >
                              {safeEpTitle}
                            </Link>
                            <p className="text-xs text-text-secondary truncate mt-0.5 font-medium">
                              {safeMediaTitle}
                            </p>
                            <p className="text-[10px] text-text-muted mt-1">
                              Viewed {formatRelativeTime(entry.watchedAt)}
                            </p>
                          </div>

                      {/* Item-level granular deletion action */}
                      <button
                        onClick={() => removeFromHistory(entry.mediaId, entry.episodeNumber)}
                        className="p-2 text-text-muted hover:text-accent-red rounded-md hover:bg-surface-hover transition-colors cursor-pointer"
                        title="Remove specific playback entry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Controls Panel */}
        <div className="w-full lg:w-[260px] shrink-0 space-y-4 bg-surface border border-border p-5 rounded-xl h-fit">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider pb-3 border-b border-border/60">
            Database Pipeline
          </h2>

          <div className="space-y-2.5">
            {/* Pause / Resume history engine switch */}
            <button
              onClick={toggleHistoryPause}
              className={`flex items-center justify-center gap-2 text-xs font-bold w-full px-4 py-2.5 rounded-lg border transition-all cursor-pointer ${
                historyPaused
                  ? 'bg-accent-green text-black border-accent-green hover:bg-accent-green/90 shadow-md'
                  : 'bg-void text-white border-border hover:bg-surface-hover'
              }`}
            >
              {historyPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
              {historyPaused ? 'Resume tracking engine' : 'Pause tracking module'}
            </button>

            {/* Clear database action */}
            <button
              onClick={() => {
                if (confirm('Are you certain you wish to purge all active client playback records?')) {
                  clearHistory();
                }
              }}
              disabled={!history.length}
              className="flex items-center justify-center gap-2 text-xs font-bold w-full px-4 py-2.5 rounded-lg bg-void border border-border hover:border-accent-red/40 text-accent-red disabled:opacity-40 disabled:hover:border-border transition-all cursor-pointer"
            >
              <Trash2 size={14} /> Purge record database
            </button>
          </div>

          <div className="pt-2">
            <h3 className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">
              Portable Synchronizer
            </h3>

            <div className="space-y-2">
              {/* JSON Payload Export Trigger */}
              <button
                onClick={handleExport}
                disabled={!history.length}
                className="flex items-center justify-center gap-2 text-xs font-bold w-full px-3 py-2 rounded-lg bg-surface-hover hover:bg-gray-700 text-white border border-white/5 disabled:opacity-40 transition-all cursor-pointer"
                title="Download JSON format cache array payload"
              >
                <Download size={13} /> Backup export cache
              </button>

              {/* JSON Payload Import Trigger */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 text-xs font-bold w-full px-3 py-2 rounded-lg bg-surface-hover hover:bg-gray-700 text-white border border-white/5 transition-all cursor-pointer"
                title="Upload JSON payload database restoration payload"
              >
                <Upload size={13} /> Restore imported file
              </button>

              {/* Hidden target file uploader input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                className="hidden"
              />
            </div>
            <p className="text-[10px] text-text-muted mt-2 leading-relaxed text-center">
              Backups persist state structures offline. Restoring databases auto-deduplicates active identical IDs seamlessly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
