'use client';

import { MessageSquare } from 'lucide-react';

export default function RecentComments() {
  return (
    <section className="bg-surface rounded-xl p-4 border border-border">
      <h3 className="text-base font-semibold text-white mb-3">Recent Comments</h3>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare size={32} className="text-text-muted mb-2" />
        <p className="text-sm text-text-muted">Be the first to comment!</p>
        <p className="text-xs text-text-muted mt-1">Share your thoughts on what you&apos;re watching.</p>
      </div>
    </section>
  );
}
