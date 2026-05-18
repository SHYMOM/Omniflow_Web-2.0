'use client';

import { useState, useEffect } from 'react';
import { PlayCircle } from 'lucide-react';
import { buildEmbedUrl } from '@/lib/utils/serverBuilder';
import type { Server } from '@/types/server';

interface VideoPlayerProps {
  malId: number;
  tmdbId: number;
  mediaType: string;
  episode: number;
  season: number;
  serverId: string;
}

export default function VideoPlayer({ malId, tmdbId, mediaType, episode, season, serverId }: VideoPlayerProps) {
  const [hasStarted, setHasStarted] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/servers.json').then(r => r.json()).then(setServers);
  }, []);

  useEffect(() => {
    const server = servers.find(s => s.id === serverId) || servers[0];
    if (!server) return;
    const type = mediaType === 'anime' ? 'anime_sub' : mediaType === 'movie' ? 'movie' : 'tv';
    const url = buildEmbedUrl(server, { type, malId, tmdbId, episode, season });
    setEmbedUrl(url);
  }, [servers, serverId, malId, tmdbId, mediaType, episode, season]);

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-border">
      {!hasStarted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 cursor-pointer" onClick={() => setHasStarted(true)}>
          <PlayCircle size={64} className="text-white/80 hover:text-white transition-colors" />
          <p className="absolute bottom-6 text-sm text-text-secondary">Click to start playing</p>
        </div>
      )}
      {hasStarted && embedUrl && (
        <iframe
          src={embedUrl}
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-pointer-lock allow-top-navigation-by-user-activation"
          allowFullScreen
          className="w-full h-full"
          title="Video Player"
        />
      )}
    </div>
  );
}
