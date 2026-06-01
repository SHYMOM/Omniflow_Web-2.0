'use client';

import Image from 'next/image';
import type { MediaItem } from '@/types/media';

interface CharactersTabProps {
  media: MediaItem;
}

export default function CharactersTab({ media }: CharactersTabProps) {
  const characters = media.characters || [];
  const staff = media.staff || [];

  return (
    <div className="space-y-10 pb-10">
      {/* Characters Grid */}
      <section>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          Characters
          <span className="text-xs font-normal text-text-secondary bg-surface px-2 py-0.5 rounded-full border border-border">
            {characters.length}
          </span>
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {characters.map((char, idx) => (
            <div key={`${char.id}-${idx}`} className="group bg-surface/30 rounded-xl overflow-hidden border border-border/50 hover:border-accent-green/30 transition-all">
              <div className="relative aspect-[3/4] overflow-hidden bg-void">
                <Image 
                  src={char.image} 
                  alt={char.name} 
                  fill 
                  className="object-cover group-hover:scale-105 transition-transform duration-500" 
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="absolute bottom-2 left-2 text-[10px] font-bold text-accent-green bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded border border-accent-green/30 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  {char.role}
                </span>
              </div>
              <div className="p-3">
                <p className="text-sm font-bold text-white line-clamp-1 group-hover:text-accent-green transition-colors">{char.name}</p>
                {char.voiceActor && (
                  <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-2">
                    <div className="relative w-6 h-6 rounded-full overflow-hidden bg-void shrink-0">
                      <Image src={char.voiceActor.image} alt={char.voiceActor.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-text-secondary truncate">{char.voiceActor.name}</p>
                      <p className="text-[8px] text-text-muted uppercase tracking-tighter">{char.voiceActor.language}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {characters.length === 0 && (
          <p className="text-text-muted text-sm italic text-center py-10 bg-surface/10 rounded-xl border border-dashed border-border">
            No character data available for this title.
          </p>
        )}
      </section>

      {/* Staff Grid */}
      <section>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          Production Staff
          <span className="text-xs font-normal text-text-secondary bg-surface px-2 py-0.5 rounded-full border border-border">
            {staff.length}
          </span>
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {staff.map((s, idx) => (
            <div key={`${s.id}-${idx}`} className="flex items-center gap-3 bg-surface/30 p-2 rounded-xl border border-border/50 hover:bg-surface/50 transition-colors group">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-void shrink-0 border border-white/5">
                <Image src={s.image} alt={s.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate group-hover:text-accent-green transition-colors">{s.name}</p>
                <p className="text-[10px] text-text-secondary truncate uppercase tracking-tighter">{s.role}</p>
              </div>
            </div>
          ))}
        </div>

        {staff.length === 0 && (
          <p className="text-text-muted text-sm italic text-center py-10 bg-surface/10 rounded-xl border border-dashed border-border">
            No staff data available for this title.
          </p>
        )}
      </section>
    </div>
  );
}
