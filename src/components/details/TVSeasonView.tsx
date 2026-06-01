'use client';

import { useQuery } from '@tanstack/react-query';
import { getTVSeasonEpisodes } from '@/lib/api/tmdb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Image from 'next/image';
import Link from 'next/link';
import { Play } from 'lucide-react';

interface TVSeasonViewProps {
  tvId: number;
  seasonNumber: number;
}

export default function TVSeasonView({ tvId, seasonNumber }: TVSeasonViewProps) {
  const { data: season, isLoading, error } = useQuery({
    queryKey: ['tv', tvId, 'season', seasonNumber],
    queryFn: () => getTVSeasonEpisodes(tvId, seasonNumber),
  });

  if (isLoading) return <div className="flex justify-center py-10"><LoadingSpinner size={30} /></div>;
  if (error || !season) return <p className="text-text-muted text-center py-10">Failed to load episodes.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">{season.name}</h3>
        <span className="text-xs text-text-muted">{season.episodes?.length} Episodes</span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {season.episodes?.map((ep) => (
          <Link
            key={ep.id}
            href={`/watch?id=tmdb-tv-${tvId}&type=tv&season=${seasonNumber}&ep=${ep.episode_number}`}
            className="flex gap-4 p-3 bg-surface/50 border border-border/50 rounded-xl hover:bg-surface hover:border-accent-green/30 transition-all group"
          >
            <div className="relative w-32 md:w-48 aspect-video rounded-lg overflow-hidden bg-void shrink-0">
              {ep.still_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                  alt={ep.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-muted text-xs bg-surface">No Preview</div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Play size={24} className="text-white fill-white" />
              </div>
              <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white font-bold">
                EP {ep.episode_number}
              </div>
            </div>
            <div className="flex-1 min-w-0 py-1">
              <h4 className="text-sm font-bold text-white group-hover:text-accent-green transition-colors truncate">
                {ep.name}
              </h4>
              <p className="text-[10px] text-text-muted mt-1">
                {ep.air_date ? new Date(ep.air_date).toLocaleDateString() : 'Unknown date'} • {ep.runtime || '??'} min
              </p>
              <p className="text-xs text-text-secondary mt-2 line-clamp-2 leading-relaxed">
                {ep.overview || "No description available for this episode."}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
