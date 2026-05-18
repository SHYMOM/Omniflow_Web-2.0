'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, Star, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { getRecentReviews } from '@/lib/api/anilist';

interface CommentType {
  id: number;
  user: string;
  avatar: string;
  text: string;
  targetTitle: string;
  time: string;
  rating: number;
}

const getTimeAgo = (createdAt: number) => {
  const diffMs = Date.now() - (createdAt * 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export default function RecentComments() {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecentReviews(3)
      .then((data) => {
        if (data && data.length > 0) {
          const mapped = data.map((item: any, index: number) => {
            const ratingScore = item.rating || item.score || 80;
            const createdTime = item.createdAt || (Math.floor(Date.now() / 1000) - (index * 3600));
            return {
              id: item.id || index,
              user: item.user?.name || 'MAL User',
              avatar: item.user?.avatar?.large || `https://api.dicebear.com/9.x/adventurer/svg?seed=${item.user?.name || index}`,
              text: item.summary || 'Great series!',
              targetTitle: item.media?.title?.english || item.media?.title?.romaji || 'Anime Series',
              time: getTimeAgo(createdTime),
              rating: Math.max(1, Math.min(5, Math.round(ratingScore / 20))),
            };
          });
          setComments(mapped);
        } else {
          setComments([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error in RecentComments fetch', err);
        setComments([]);
        setLoading(false);
      });
  }, []);

  if (!loading && comments.length === 0) return null;

  return (
    <section className="bg-surface rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/40">
        <MessageSquare size={16} className="text-accent-green" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Community Discussions</h3>
      </div>

      {loading ? (
        <div className="space-y-4 py-6 flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-accent-green" size={20} />
          <span className="text-[11px] text-text-secondary font-bold tracking-tight">Syncing real commentaries...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(c => (
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
      )}
    </section>
  );
}
