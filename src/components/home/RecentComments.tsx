'use client';

import { MessageSquare, Star } from 'lucide-react';
import Image from 'next/image';

const COMMENTS = [
  {
    id: 1,
    user: 'Kage_Sama',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Kage_Sama',
    text: 'The animation quality in this latest episode is absolutely breathtaking. Mappa really outdid themselves!',
    targetTitle: 'Jujutsu Kaisen Season 2',
    time: '5m ago',
    rating: 5,
  },
  {
    id: 2,
    user: 'Sakura_Petal',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=Sakura_Petal',
    text: 'That plot twist at the end left me completely speechless. Cannot wait for the next broadcast chapter.',
    targetTitle: 'Attack on Titan: Final Chapters',
    time: '24m ago',
    rating: 5,
  },
  {
    id: 3,
    user: 'OtakuGamer',
    avatar: 'https://api.dicebear.com/9.x/adventurer/svg?seed=OtakuGamer',
    text: 'Highly recommend watching this in crisp 1080p audio. The sound design is flawless.',
    targetTitle: 'Chainsaw Man',
    time: '1h ago',
    rating: 4.5,
  },
];

export default function RecentComments() {
  return (
    <section className="bg-surface rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/40">
        <MessageSquare size={16} className="text-accent-green" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Community Discussions</h3>
      </div>
      <div className="space-y-4">
        {COMMENTS.map(c => (
          <div key={c.id} className="group bg-void/50 p-3 rounded-lg border border-border/30 hover:border-accent-green/30 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded-full overflow-hidden bg-surface shrink-0 border border-white/10">
                  <Image src={c.avatar} alt={c.user} fill className="object-cover" unoptimized />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-accent-green transition-colors">{c.user}</span>
              </div>
              <span className="text-[10px] text-text-muted">{c.time}</span>
            </div>
            <p className="text-[11px] text-accent-green/90 font-medium mb-1 truncate">
              {c.targetTitle}
            </p>
            <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
              &ldquo;{c.text}&rdquo;
            </p>
            <div className="flex items-center gap-0.5 mt-2 text-accent-gold">
              {Array.from({ length: Math.floor(c.rating) }).map((_, i) => (
                <Star key={i} size={10} fill="currentColor" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
