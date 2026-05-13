'use client';

import { useUserStore } from '@/store/userStore';
import { useUIStore } from '@/store/uiStore';
import { LogOut, User } from 'lucide-react';

export default function ProfilePage() {
  const { user, signOut, watchlist, history, settings, updateSettings } = useUserStore();
  const { setAuthModalOpen } = useUIStore();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <User size={48} className="text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Not signed in</h2>
        <p className="text-text-secondary mb-6">Sign in to access your profile and settings.</p>
        <button onClick={() => setAuthModalOpen(true)} className="bg-white text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-gray-200 transition-colors">
          Sign In
        </button>
      </div>
    );
  }

  const totalWatchedHours = Math.round(history.reduce((acc, h) => acc + h.duration * h.progress, 0) / 3600);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Profile header */}
      <div className="bg-surface rounded-xl p-6 border border-border mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-accent-green/20 border-2 border-accent-green flex items-center justify-center text-accent-green text-2xl font-bold">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{user.username}</h1>
            <p className="text-sm text-text-secondary">Member since {new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={signOut} className="flex items-center gap-2 text-sm text-accent-red px-4 py-2 rounded-lg bg-surface-hover hover:bg-accent-red/10 transition-colors">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-surface rounded-xl p-6 border border-border mb-6">
        <h2 className="text-base font-semibold text-white mb-4">Stats</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-2xl font-bold text-white">{watchlist.length}</p><p className="text-xs text-text-secondary">In List</p></div>
          <div><p className="text-2xl font-bold text-white">{history.length}</p><p className="text-xs text-text-secondary">Watched</p></div>
          <div><p className="text-2xl font-bold text-white">{totalWatchedHours}h</p><p className="text-xs text-text-secondary">Watch Time</p></div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-surface rounded-xl p-6 border border-border">
        <h2 className="text-base font-semibold text-white mb-4">Settings</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Auto-play next episode</span>
            <input type="checkbox" checked={settings.autoPlayNext} onChange={e => updateSettings({ autoPlayNext: e.target.checked })} className="accent-accent-green w-4 h-4" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">Default to dub</span>
            <input type="checkbox" checked={settings.defaultToDub} onChange={e => updateSettings({ defaultToDub: e.target.checked })} className="accent-accent-green w-4 h-4" />
          </label>
        </div>
      </div>
    </div>
  );
}
