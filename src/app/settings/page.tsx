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
  Check,
  Subtitles
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

export default function SettingsPage() {
  const { user, signOut, settings, updateSettings, subtitleSettings, updateSubtitleSettings } = useUserStore();
  const [activeTab, setActiveTab] = useState('General');

  const tabs = [
    { id: 'General', icon: SettingsIcon },
    { id: 'Account', icon: User },
    { id: 'Playback', icon: PlayCircle },
    { id: 'Interface', icon: Monitor },
    { id: 'Subtitles', icon: Subtitles },
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

          {activeTab === 'Subtitles' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 className="text-lg font-bold text-white mb-4">Subtitle Appearance</h3>
                
                {/* Live Preview */}
                <div className="relative w-full aspect-video md:aspect-[21/9] bg-black rounded-xl overflow-hidden mb-6 border border-border flex flex-col p-4">
                  <Image src="https://s4.anilist.co/file/anilistcdn/media/anime/banner/21-wf37VakJmZqs.jpg" alt="Preview Background" fill className="object-cover opacity-40" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                  
                  {/* The actual subtitle preview */}
                  <div className="relative flex-1 flex flex-col z-10 w-full h-full">
                    <div 
                      className="w-full text-center transition-all duration-300"
                      style={{
                        fontFamily: subtitleSettings?.fontFamily || 'Inter',
                        fontSize: `${subtitleSettings?.fontSize || 32}px`,
                        color: subtitleSettings?.fontColor || '#ffffff',
                        backgroundColor: subtitleSettings?.backgroundColor ? `${subtitleSettings.backgroundColor}${Math.floor((subtitleSettings.backgroundOpacity ?? 0.5) * 255).toString(16).padStart(2, '0')}` : 'rgba(0,0,0,0.5)',
                        textShadow: (subtitleSettings?.outlineWidth || 0) > 0 
                          ? `0 0 ${subtitleSettings.outlineWidth}px ${subtitleSettings.outlineColor}, 0 0 ${subtitleSettings.outlineWidth}px ${subtitleSettings.outlineColor}`
                          : 'none',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        margin: '0 auto',
                        marginBottom: subtitleSettings?.position === 'bottom' ? `${subtitleSettings.offsetY ?? 20}px` : 'auto',
                        marginTop: subtitleSettings?.position === 'top' ? `${subtitleSettings.offsetY ?? 20}px` : 'auto',
                        lineHeight: '1.2'
                      }}
                    >
                      I will become the Pirate King!
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Font Family */}
                  <div className="p-4 rounded-xl border border-border bg-void/30">
                    <label className="block text-sm font-bold text-white mb-2">Font Family</label>
                    <select 
                      className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-green"
                      value={subtitleSettings?.fontFamily || 'Inter'}
                      onChange={(e) => updateSubtitleSettings({ fontFamily: e.target.value })}
                    >
                      <option value="Inter">Inter</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Arial">Arial</option>
                      <option value="Trebuchet MS">Trebuchet MS</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                    </select>
                  </div>

                  {/* Font Size */}
                  <div className="p-4 rounded-xl border border-border bg-void/30">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-white">Font Size</label>
                      <span className="text-xs text-accent-green font-mono">{subtitleSettings?.fontSize || 32}px</span>
                    </div>
                    <input 
                      type="range" min="14" max="64" 
                      value={subtitleSettings?.fontSize || 32}
                      onChange={(e) => updateSubtitleSettings({ fontSize: Number(e.target.value) })}
                      className="w-full accent-accent-green"
                    />
                  </div>

                  {/* Colors */}
                  <div className="p-4 rounded-xl border border-border bg-void/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-white">Text Color</label>
                      <input 
                        type="color" 
                        value={subtitleSettings?.fontColor || '#ffffff'}
                        onChange={(e) => updateSubtitleSettings({ fontColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-white">Background Color</label>
                      <input 
                        type="color" 
                        value={subtitleSettings?.backgroundColor || '#000000'}
                        onChange={(e) => updateSubtitleSettings({ backgroundColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-white">Outline Color</label>
                      <input 
                        type="color" 
                        value={subtitleSettings?.outlineColor || '#000000'}
                        onChange={(e) => updateSubtitleSettings({ outlineColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                    </div>
                  </div>

                  {/* Opacity & Position */}
                  <div className="p-4 rounded-xl border border-border bg-void/30 space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-white">Background Opacity</label>
                        <span className="text-[10px] text-accent-green">{Math.round((subtitleSettings?.backgroundOpacity ?? 0.5) * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.1"
                        value={subtitleSettings?.backgroundOpacity ?? 0.5}
                        onChange={(e) => updateSubtitleSettings({ backgroundOpacity: Number(e.target.value) })}
                        className="w-full accent-accent-green"
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-white">Outline Width</label>
                        <span className="text-[10px] text-accent-green">{subtitleSettings?.outlineWidth || 0}px</span>
                      </div>
                      <input 
                        type="range" min="0" max="4" step="1"
                        value={subtitleSettings?.outlineWidth || 0}
                        onChange={(e) => updateSubtitleSettings({ outlineWidth: Number(e.target.value) })}
                        className="w-full accent-accent-green"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-white">Vertical Offset</label>
                        <span className="text-[10px] text-accent-green">{subtitleSettings?.offsetY ?? 20}px</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" step="5"
                        value={subtitleSettings?.offsetY ?? 20}
                        onChange={(e) => updateSubtitleSettings({ offsetY: Number(e.target.value) })}
                        className="w-full accent-accent-green"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex justify-end">
                  <button 
                    onClick={() => updateSubtitleSettings({
                      fontFamily: 'Inter', fontSize: 32, fontColor: '#ffffff', backgroundColor: '#000000', 
                      backgroundOpacity: 0.5, outlineColor: '#000000', outlineWidth: 2, position: 'bottom', offsetY: 20
                    })}
                    className="text-xs font-bold text-text-secondary hover:text-white px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
                  >
                    Reset to Defaults
                  </button>
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
