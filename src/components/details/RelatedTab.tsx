'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { AniListMedia } from '@/types/anilist';
import { formatMediaType } from '@/lib/utils/formatters';

interface RelatedTabProps { media: AniListMedia; }

export default function RelatedTab({ media }: RelatedTabProps) {
  const relations = media.relations?.edges || [];
  const relationTypes = ['All', ...new Set(relations.map(r => r.relationType))];
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? relations : relations.filter(r => r.relationType === filter);

  return (
    <div className="pb-8">
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {relationTypes.map((type) => (
          <button key={type} onClick={() => setFilter(type)} className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${filter === type ? 'bg-white text-black border-white' : 'bg-surface text-white border-border hover:border-white/30'}`}>
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-3">
        {filtered.map((edge) => {
          const node = edge.node;
          const title = node.title.english || node.title.romaji;
          const href = node.type === 'MANGA' ? `/manga/${node.id}` : `/anime/${node.id}`;
          return (
            <Link key={node.id} href={href} className="group">
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface mb-1.5">
                <Image src={node.coverImage.large} alt={title} fill className="object-cover group-hover:scale-105 transition-transform" />
                <span className="absolute top-1 left-1 bg-surface/90 text-white text-[10px] px-1.5 py-0.5 rounded">{edge.relationType.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-[11px] text-text-secondary">{formatMediaType(node.format)} {node.seasonYear || ''}</p>
              <p className="text-[13px] text-white line-clamp-1">{title}</p>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && <p className="text-center text-text-muted py-8">No related media found.</p>}
    </div>
  );
}
