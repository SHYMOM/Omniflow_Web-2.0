'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import toast from 'react-hot-toast';
import { Search, Plus, Trash2, Image as ImageIcon, Link as LinkIcon, Edit, RefreshCw, Power } from 'lucide-react';
import { searchHybrid } from '@/lib/api/hybrid';
import type { MediaItem } from '@/types/media';
import Image from 'next/image';

export default function AdsManager() {
  const supabase = createClient();
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalEnabled, setGlobalEnabled] = useState(true);

  // Form state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [isGlobal, setIsGlobal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [adTitle, setAdTitle] = useState('');
  const [adImageUrl, setAdImageUrl] = useState('');
  const [adVideoUrl, setAdVideoUrl] = useState('');
  const [adTargetUrl, setAdTargetUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAdsAndSettings = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch global setting
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'global_ads_enabled')
        .single();
      
      if (settingsData) {
        setGlobalEnabled(settingsData.value === 'true');
      }

      // Fetch ads
      const { data: adsData, error } = await supabase
        .from('media_ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAds(adsData || []);
    } catch (err: any) {
      console.error('Error fetching ads:', err);
      toast.error('Failed to load ads configuration');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAdsAndSettings();
  }, [fetchAdsAndSettings]);

  const toggleGlobalAds = async () => {
    const newValue = !globalEnabled;
    const { error } = await supabase
      .from('system_settings')
      .upsert({ key: 'global_ads_enabled', value: newValue ? 'true' : 'false', updated_at: new Date().toISOString() });

    if (error) {
      toast.error('Failed to update global ad settings');
    } else {
      setGlobalEnabled(newValue);
      toast.success(`Global ads ${newValue ? 'enabled' : 'disabled'}`);
    }
  };

  const toggleAdActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('media_ads')
      .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to update ad status');
    } else {
      toast.success('Ad status updated');
      fetchAdsAndSettings();
    }
  };

  const deleteAd = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;
    const { error } = await supabase
      .from('media_ads')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete ad');
    } else {
      toast.success('Ad deleted successfully');
      fetchAdsAndSettings();
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchHybrid(searchQuery, 1, false);
        setSearchResults(results.slice(0, 5));
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSelectMedia = (media: MediaItem) => {
    setSelectedMedia(media);
    setSearchQuery('');
    setSearchResults([]);
    if (!adTitle) {
      setAdTitle(`${media.title} Ad Campaign`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGlobal && !selectedMedia) return toast.error('Please select a media item');
    if (!adTitle || !adImageUrl || !adTargetUrl) return toast.error('Please fill in all required fields');

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('media_ads')
        .insert({
          media_id: isGlobal ? null : String(selectedMedia?.id),
          media_type: isGlobal ? null : (selectedMedia?.type || 'anime'),
          title: adTitle,
          image_url: adImageUrl,
          video_url: adVideoUrl || null,
          target_url: adTargetUrl,
          is_global: isGlobal,
          is_active: true
        });

      if (error) throw error;

      toast.success('Ad campaign created successfully');
      // Reset form
      setSelectedMedia(null);
      setAdTitle('');
      setAdImageUrl('');
      setAdVideoUrl('');
      setAdTargetUrl('');
      fetchAdsAndSettings();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create ad');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Global Control */}
      <div className="bg-surface rounded-xl border border-border p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Targeted Media Ads
          </h3>
          <p className="text-text-secondary text-xs mt-1">
            Display specific banner ads when users watch targeted movies, TV shows, or anime.
          </p>
        </div>
        <button
          onClick={toggleGlobalAds}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-xs transition-all cursor-pointer ${
            globalEnabled 
              ? 'bg-accent-green/20 text-accent-green border-accent-green/30 hover:bg-accent-green/30' 
              : 'bg-accent-red/20 text-accent-red border-accent-red/30 hover:bg-accent-red/30'
          }`}
        >
          <Power size={14} />
          {globalEnabled ? 'Ads Globally Enabled' : 'Ads Globally Disabled'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Ad Form */}
        <div className="lg:col-span-1 bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-void/30">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <Plus size={16} className="text-accent-green" />
              Create New Ad Campaign
            </h4>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Target Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Targeting Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setIsGlobal(false); setSelectedMedia(null); }}
                  className={`py-1.5 px-3 rounded text-xs font-bold border transition-all cursor-pointer ${
                    !isGlobal 
                      ? 'bg-accent-green/20 text-accent-green border-accent-green/30' 
                      : 'bg-void text-text-secondary border-border hover:text-white'
                  }`}
                >
                  Specific Media
                </button>
                <button
                  type="button"
                  onClick={() => { setIsGlobal(true); setSelectedMedia(null); if (!adTitle) setAdTitle('Global Ad Campaign'); }}
                  className={`py-1.5 px-3 rounded text-xs font-bold border transition-all cursor-pointer ${
                    isGlobal 
                      ? 'bg-accent-green/20 text-accent-green border-accent-green/30' 
                      : 'bg-void text-text-secondary border-border hover:text-white'
                  }`}
                >
                  Global Override
                </button>
              </div>
            </div>

            {/* Media Selection */}
            {!isGlobal && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Target Media</label>
                
                {!selectedMedia ? (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-text-muted" size={14} />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search movie, show, or anime..."
                        className="w-full bg-void border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors"
                      />
                      {searching && <RefreshCw className="absolute right-3 top-2.5 text-text-muted animate-spin" size={14} />}
                    </div>
                    
                    {/* Search Dropdown */}
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                        {searchResults.map((result) => (
                          <div 
                            key={result.id}
                            onClick={() => handleSelectMedia(result)}
                            className="flex items-center gap-3 p-2 hover:bg-void cursor-pointer border-b border-border/50 last:border-0"
                          >
                            {result.posterUrl ? (
                              <img src={result.posterUrl} alt={result.title} className="w-8 h-12 object-cover rounded" />
                            ) : (
                              <div className="w-8 h-12 bg-void rounded flex items-center justify-center border border-border"><ImageIcon size={12} className="text-text-muted"/></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">{result.title}</p>
                              <p className="text-[10px] text-text-muted">{result.formatLabel} • {result.year}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-void border border-accent-green/30 p-2 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img src={selectedMedia.posterUrl} alt={selectedMedia.title} className="w-8 h-12 object-cover rounded" />
                      <div>
                        <p className="text-xs font-bold text-white line-clamp-1">{selectedMedia.title}</p>
                        <p className="text-[10px] text-accent-green">{selectedMedia.formatLabel} ({selectedMedia.id})</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedMedia(null)}
                      className="p-1.5 text-text-muted hover:text-accent-red transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Campaign Title</label>
              <input 
                type="text" 
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                placeholder="e.g. One Piece Merch Sale"
                className="w-full bg-void border border-border rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Banner Image URL (Required fallback)</label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-2.5 text-text-muted" size={14} />
                <input 
                  type="url" 
                  value={adImageUrl}
                  onChange={(e) => setAdImageUrl(e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full bg-void border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Video Ad URL (Optional pre-roll)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 text-text-muted" size={14} />
                <input 
                  type="url" 
                  value={adVideoUrl}
                  onChange={(e) => setAdVideoUrl(e.target.value)}
                  placeholder="https://example.com/pre-roll-ad.mp4"
                  className="w-full bg-void border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Target Destination URL</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-2.5 text-text-muted" size={14} />
                <input 
                  type="url" 
                  value={adTargetUrl}
                  onChange={(e) => setAdTargetUrl(e.target.value)}
                  placeholder="https://store.example.com/item"
                  className="w-full bg-void border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-white outline-none focus:border-accent-green transition-colors"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || (!isGlobal && !selectedMedia)}
              className="w-full mt-4 px-4 py-2 bg-accent-green hover:bg-accent-green/90 text-black rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </form>
        </div>

        {/* Ads List */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center bg-void/30">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              Active Campaigns
            </h4>
            <button onClick={fetchAdsAndSettings} className="text-text-muted hover:text-white transition-colors cursor-pointer">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-12 text-center text-text-secondary flex flex-col items-center justify-center">
                <RefreshCw className="animate-spin text-accent-green mb-2" size={24} />
                <span className="text-sm">Loading campaigns...</span>
              </div>
            ) : ads.length === 0 ? (
              <div className="p-12 text-center text-text-secondary flex flex-col items-center justify-center">
                <span className="text-sm">No ad campaigns found. Create one to get started.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-void/50 text-text-secondary uppercase tracking-wider border-b border-border">
                    <th className="p-4 font-semibold">Banner</th>
                    <th className="p-4 font-semibold">Campaign Info</th>
                    <th className="p-4 font-semibold">Target Media ID</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-white">
                  {ads.map((ad) => (
                    <tr key={ad.id} className="hover:bg-void/10 transition-colors">
                      <td className="p-4">
                        <div className="w-24 h-12 bg-void rounded border border-border overflow-hidden relative">
                          <img src={ad.image_url} alt="Ad Banner" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/468x60?text=Invalid+Image')} />
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-bold mb-0.5">{ad.title}</p>
                        <div className="flex flex-col gap-1">
                          <a href={ad.target_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent-green hover:underline flex items-center gap-1">
                            <LinkIcon size={10} /> Destination Link
                          </a>
                          {ad.video_url && (
                            <span className="text-[10px] text-text-secondary truncate max-w-[200px]" title={ad.video_url}>
                              Video: {ad.video_url}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {ad.is_global ? (
                          <span className="text-[10px] font-bold text-accent-green bg-accent-green/20 px-2 py-1 rounded border border-accent-green/30 uppercase">
                            Global Campaign
                          </span>
                        ) : (
                          <>
                            <span className="font-mono text-text-muted bg-void px-2 py-1 rounded border border-border">
                              {ad.media_id}
                            </span>
                            <p className="text-[10px] text-text-secondary mt-1 uppercase">{ad.media_type}</p>
                          </>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleAdActive(ad.id, ad.is_active)}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                            ad.is_active 
                              ? 'bg-accent-green/20 text-accent-green border border-accent-green/30' 
                              : 'bg-void text-text-muted border border-border'
                          }`}
                        >
                          {ad.is_active ? 'Active' : 'Paused'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => deleteAd(ad.id)}
                          className="p-1.5 bg-void hover:bg-accent-red/20 text-text-secondary hover:text-accent-red rounded border border-border hover:border-accent-red/30 transition-all cursor-pointer inline-flex"
                          title="Delete Ad"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
