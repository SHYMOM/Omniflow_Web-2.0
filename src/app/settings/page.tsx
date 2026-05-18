'use client';

import { useState } from 'react';
import { useUserStore } from '@/store/userStore';
import { 
  User, 
  Settings as SettingsIcon, 
  PlayCircle, 
  Eye, 
  ShieldCheck, 
  Monitor, 
  Globe, 
  Bell,
  LogOut,
  ChevronRight,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export default function SettingsPage() {
  const { user, signOut, settings, updateSettings } = useUserStore();
  const [activeTab, setActiveTab] = useState('General');

  const tabs = [
    { id: 'General', icon: SettingsIcon },
    { id: 'Account', icon: User },
    { id: 'Playback', icon: PlayCircle },
    { id: 'Interface', icon: Monitor },
    { id: 'Privacy', icon: ShieldCheck },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 pt-24 min-h-screen">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-2">
          <h1 className="text-2xl font-bold text-white mb-6 font-display px-2">Settings</h1>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                activeTab === tab.id 
                  ? "bg-accent-green/10 text-accent-green border border-accent-green/20" 
                  : "text-text-secondary hover:text-white hover:bg-surface/50"
              )}
            >
              <tab.icon size={18} />
              {tab.id}
              {activeTab === tab.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_8px_rgba(168,255,53,0.8)]" />}
            </button>
          ))}
          
          <div className="pt-10">
            <button 
              onClick={() => signOut()}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-medium"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-surface/30 border border-border rounded-2xl p-6 md:p-8 backdrop-blur-sm">
          
          {activeTab === 'General' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 className="text-lg font-bold text-white mb-4">Application Preferences</h3>
                <div className="space-y-4">
                  <SettingToggle 
                    label="Language" 
                    description="Choose your preferred interface language" 
                    value="English" 
                    icon={Globe}
                  />
                  <SettingToggle 
                    label="Notifications" 
                    description="Receive alerts about new episodes and updates" 
                    checked={true}
                    icon={Bell}
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Playback' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 className="text-lg font-bold text-white mb-4">Player Controls</h3>
                <div className="space-y-4">
                  <SettingSwitch 
                    label="Autoplay Next Episode" 
                    description="Automatically start the next episode after one ends"
                    checked={settings.autoPlayNext}
                    onChange={(val: boolean) => updateSettings({ autoPlayNext: val })}
                  />
                  <SettingSwitch 
                    label="Autoplay Hero Trailers" 
                    description="Play trailers automatically on the homepage banner"
                    checked={settings.autoPlayTrailer}
                    onChange={(val: boolean) => updateSettings({ autoPlayTrailer: val })}
                  />
                  <SettingSwitch 
                    label="Default to Dub" 
                    description="Prefer dubbed audio when available"
                    checked={settings.defaultToDub}
                    onChange={(val: boolean) => updateSettings({ defaultToDub: val })}
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Interface' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 className="text-lg font-bold text-white mb-4">Appearance</h3>
                <div className="space-y-4">
                  <SettingToggle 
                    label="Theme Mode" 
                    description="Switch between dark, light, and system themes" 
                    value={
                      settings.theme === 'light' ? 'Light Mode' :
                      settings.theme === 'dark' ? 'Standard Dark' : 'Midnight Dark'
                    }
                    icon={Monitor}
                    onClick={() => {
                      const nextTheme = 
                        settings.theme === 'midnight' ? 'dark' :
                        settings.theme === 'dark' ? 'light' : 'midnight';
                      updateSettings({ theme: nextTheme });
                    }}
                  />
                  <div className="p-4 rounded-xl border border-border bg-void/30">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-white">Primary Brand Color</h4>
                        <p className="text-xs text-text-muted">Choose your signature accent color</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {['#00E676', '#FF357A', '#35A8FF', '#FF9F35', '#B035FF'].map(color => (
                        <button 
                          key={color}
                          onClick={() => updateSettings({ brandColor: color })}
                          style={{ backgroundColor: color }}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 cursor-pointer",
                            (settings.brandColor || '#00E676') === color ? "border-white shadow-[0_0_10px_rgba(0,230,118,0.5)]" : "border-transparent"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Privacy' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 className="text-lg font-bold text-white mb-4">Security & Safety</h3>
                <div className="space-y-4">
                  <SettingSwitch 
                    label="Hide Adult Content" 
                    description="Filter out mature/18+ media from all browsing lists and search results"
                    checked={settings.hideAdult}
                    onChange={(val: boolean) => updateSettings({ hideAdult: val })}
                  />
                  <SettingSwitch 
                    label="Incognito Mode" 
                    description="Don't record watch history while this is active"
                    checked={settings.incognitoMode ?? false}
                    onChange={(val: boolean) => updateSettings({ incognitoMode: val })}
                  />
                  <SettingToggle 
                    label="Two-Factor Authentication" 
                    description="Add an extra layer of security to your account" 
                    value="Disabled" 
                    icon={ShieldCheck}
                  />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'Account' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 className="text-lg font-bold text-white mb-4">Profile Information</h3>
                <div className="flex items-center gap-6 p-6 bg-void/50 rounded-2xl border border-border">
                  <div className="w-20 h-20 rounded-full bg-accent-green/20 border-2 border-accent-green flex items-center justify-center text-3xl font-bold text-accent-green">
                    {user?.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white">{user?.username || 'Guest'}</h4>
                    <p className="text-text-secondary text-sm">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Today'}</p>
                    <button className="mt-3 text-xs font-bold text-accent-green uppercase tracking-wider hover:underline">Change Avatar</button>
                  </div>
                </div>
              </section>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function SettingToggle({ label, description, value, icon: Icon, onClick }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-void/30 rounded-xl border border-border hover:border-white/10 transition-all group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-text-secondary group-hover:text-accent-green transition-colors">
          <Icon size={20} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{label}</p>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
      </div>
      <button 
        onClick={onClick}
        className="flex items-center gap-2 text-xs font-medium text-text-secondary bg-surface px-3 py-1.5 rounded-lg border border-border hover:text-white transition-all cursor-pointer"
      >
        {value} <ChevronRight size={14} />
      </button>
    </div>
  );
}

function SettingSwitch({ label, description, checked, onChange }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-void/30 rounded-xl border border-border hover:border-white/10 transition-all">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
      <button 
        onClick={() => onChange(!checked)}
        className={cn(
          "w-12 h-6 rounded-full p-1 transition-all duration-300 flex items-center",
          checked ? "bg-accent-green" : "bg-surface border border-border"
        )}
      >
        <div className={cn(
          "w-4 h-4 rounded-full transition-all duration-300 shadow-sm flex items-center justify-center",
          checked ? "bg-black translate-x-6" : "bg-text-muted translate-x-0"
        )}>
          {checked && <Check size={10} className="text-accent-green" />}
        </div>
      </button>
    </div>
  );
}
