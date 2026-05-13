'use client';

import { useState, useEffect } from 'react';
import { usePlayerStore } from '@/store/playerStore';
import type { Server } from '@/types/server';
import { cn } from '@/lib/utils/cn';

interface ServerSwitcherProps { mediaType: string; }

export default function ServerSwitcher({ mediaType }: ServerSwitcherProps) {
  const { activeServerId, setActiveServer } = usePlayerStore();
  const [servers, setServers] = useState<Server[]>([]);

  useEffect(() => {
    fetch('/servers.json').then(r => r.json()).then(setServers);
  }, []);

  const patternKey = mediaType === 'anime' ? 'anime_sub' : mediaType === 'movie' ? 'movie' : 'tv';
  const available = servers.filter(s => s.status === 'active' && s.patterns[patternKey as keyof typeof s.patterns]);

  return (
    <div className="mt-4">
      <p className="text-sm text-text-secondary mb-2">Servers</p>
      <div className="flex flex-wrap gap-2">
        {available.map((server) => (
          <button key={server.id} onClick={() => setActiveServer(server.id)} className={cn('text-sm px-3 py-1.5 rounded-lg border transition-colors', activeServerId === server.id ? 'bg-accent-green/20 border-accent-green text-white' : 'bg-surface border-border text-text-secondary hover:text-white')}>
            {server.recommended && '★ '}{server.name}
          </button>
        ))}
      </div>
    </div>
  );
}
