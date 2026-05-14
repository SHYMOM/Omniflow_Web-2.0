'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { MediaItem } from '@/types/media';

interface RelatedTabProps { media: MediaItem; }

export default function RelatedTab({ media }: RelatedTabProps) {
  const relations = media.relations || [];
  const relationTypes = ['All', ...new Set(relations.map(r => r.relationType))];
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? relations : relations.filter(r => r.relationType === filter);

  return (
    <div className="pb-8">
      {/* Filter chips */}
      {relationTypes.length > 2 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {relationTypes.map((type) => (
            <button key={type} onClick={() => setFilter(type)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all uppercase tracking-wider ${filter === type ? 'bg-accent-green text-black border-accent-green' : 'bg-surface text-text-secondary border-border hover:border-accent-green/50 hover:text-white'}`}>
              {type.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
        {(() => {
          const seen = new Set();
          return filtered.map((rel, idx) => {
            if (seen.has(rel.id)) return null;
            seen.add(rel.id);

            const href = `/${rel.type}/${rel.id}`;
            return (
              <Link key={`${rel.id}-${idx}`} href={href} className="group">
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface mb-1.5 border border-white/5 group-hover:border-accent-green/40 group-hover:shadow-[0_0_15px_rgba(168,255,53,0.15)] transition-all">
                  <Image src={rel.posterUrl} alt={rel.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  <span className="absolute top-1 left-1 bg-void/90 backdrop-blur-sm text-accent-green font-bold text-[8px] px-1.5 py-0.5 rounded border border-accent-green/30 uppercase tracking-widest">{rel.relationType.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">{rel.formatLabel}</p>
                <p className="text-[13px] text-white line-clamp-1 group-hover:text-accent-green transition-colors font-medium">{rel.title}</p>
              </Link>
            );
          });
        })()}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-surface/20 rounded-xl border border-dashed border-border">
          <p className="text-text-muted text-sm italic">No related media found.</p>
        </div>
      )}
    </div>
  );
}
