'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import toast from 'react-hot-toast';
import { 
  Shield, 
  User as UserIcon, 
  Activity, 
  Database, 
  Trash2, 
  Search, 
  Filter, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Server, 
  Film, 
  BookOpen,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import AdsManager from '@/components/admin/AdsManager';
import { useUserStore } from '@/store/userStore';



const supabase = createClient();

export default function AdminPage() {
  const router = useRouter();

  // Auth state — driven entirely by Supabase, not localStorage
  const [adminStatus, setAdminStatus] = useState<'loading' | 'unauthorized' | 'authorized'>('loading');
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'cache' | 'ads'>('users');

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    adminsCount: 0,
    logsCount: 0,
    cacheStreamsCount: 0,
    cacheSubtitlesCount: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Users Tab State
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'moderator' | 'user'>('all');

  // Logs Tab State
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'fatal'>('all');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Cache Tab State
  const [cachedStreams, setCachedStreams] = useState<any[]>([]);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [cacheSearch, setCacheSearch] = useState('');


  const storeUser = useUserStore((s) => s.user);

  // Verify admin status directly from Supabase on mount, using Zustand user as initial source of truth
  useEffect(() => {
    let cancelled = false;
    
    // If the Zustand store already knows the user is an admin, show the UI immediately to prevent blocking
    if (storeUser && storeUser.role === 'admin') {
      setAdminUserId(storeUser.id);
      setAdminStatus('authorized');
    }

    const verifyAdmin = async () => {
      try {
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !authUser) {
          if (!cancelled) {
            setAdminStatus('unauthorized');
            router.push('/');
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authUser.id)
          .single();

        if (profileError || !profile) {
          if (!cancelled) {
            setAdminStatus('unauthorized');
            router.push('/');
          }
          return;
        }

        if (!cancelled) {
          if (profile.role === 'admin') {
            setAdminUserId(authUser.id);
            setAdminStatus('authorized');
          } else {
            setAdminStatus('unauthorized');
            router.push('/');
          }
        }
      } catch (err) {
        console.error('[AdminPage] Verification error:', err);
        if (!cancelled) {
          // If the network request fails, but the client store has admin role, we can allow it as a fallback
          if (storeUser && storeUser.role === 'admin') {
            setAdminUserId(storeUser.id);
            setAdminStatus('authorized');
          } else {
            setAdminStatus('unauthorized');
            router.push('/');
          }
        }
      }
    };

    verifyAdmin();
    return () => { cancelled = true; };
  }, [storeUser, supabase, router]);

  // Fetch all stats (parallel for speed)
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const [usersRes, adminsRes, logsRes, streamsRes, subsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('system_logs').select('*', { count: 'exact', head: true }),
        supabase.from('cached_streams').select('*', { count: 'exact', head: true }),
        supabase.from('cached_subtitles').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        adminsCount: adminsRes.count || 0,
        logsCount: logsRes.count || 0,
        cacheStreamsCount: streamsRes.count || 0,
        cacheSubtitlesCount: subsRes.count || 0
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
      toast.error('Stats Error: ' + err.message, { id: 'stats-err', duration: 10000 });
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch users data
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        toast.error('Failed to fetch users: ' + error.message, { duration: 10000 });
      } else if (data) {
        setUsers(data);
      }
    } catch (err: any) {
      console.error('Exception in fetchUsers:', err);
      toast.error('Users Exception: ' + err.message, { id: 'users-err', duration: 10000 });
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch system logs
  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) {
        toast.error('Failed to fetch logs: ' + error.message);
      } else if (data) {
        setLogs(data);
      }
    } catch (err: any) {
      console.error('Exception in fetchLogs:', err);
      toast.error('Logs Exception: ' + err.message, { id: 'logs-err', duration: 10000 });
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch cache items for list
  const fetchCacheList = async () => {
    setCacheLoading(true);
    try {
      const { data, error } = await supabase
        .from('cached_streams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (error) {
        toast.error('Failed to fetch cached streams: ' + error.message);
      } else if (data) {
        setCachedStreams(data);
      }
    } catch (err: any) {
      console.error('Exception in fetchCacheList:', err);
      toast.error('Cache Exception: ' + err.message, { id: 'cache-err', duration: 10000 });
    } finally {
      setCacheLoading(false);
    }
  };

  // Only fetch data AFTER admin status is confirmed from Supabase
  useEffect(() => {
    if (adminStatus !== 'authorized') return;
    fetchStats();
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'logs') {
      fetchLogs();
    } else if (activeTab === 'cache') {
      fetchCacheList();
    }
  }, [activeTab, adminStatus]);


  const handleRefresh = () => {
    fetchStats();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'logs') fetchLogs();
    if (activeTab === 'cache') fetchCacheList();
    toast.success('Data refreshed');
  };

  // User tab actions
  const changeUserRole = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      console.error('Change role error:', error);
      toast.error('Failed to update role. Please ensure you are an authenticated admin.');
    } else {
      toast.success(`User role updated to ${newRole}`);
      fetchUsers();
      fetchStats();
    }
  };

  // Logs tab actions
  const purgeLogs = async () => {
    if (!confirm('Are you sure you want to delete all system logs? This cannot be undone.')) return;
    
    const { error } = await supabase
      .from('system_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      console.error('Purge logs error:', error);
      toast.error('Failed to purge logs: ' + error.message);
    } else {
      toast.success('System logs purged successfully');
      fetchLogs();
      fetchStats();
    }
  };

  // Cache tab actions
  const purgeCacheStreams = async () => {
    if (!confirm('Are you sure you want to clear all cached video streams?')) return;
    const { error } = await supabase
      .from('cached_streams')
      .delete()
      .neq('media_id', '');

    if (error) {
      toast.error('Failed to clear streams cache');
    } else {
      toast.success('Cached streams cleared');
      fetchCacheList();
      fetchStats();
    }
  };

  const purgeCacheSubtitles = async () => {
    if (!confirm('Are you sure you want to clear all cached subtitles?')) return;
    const { error } = await supabase
      .from('cached_subtitles')
      .delete()
      .neq('media_id', '');

    if (error) {
      toast.error('Failed to clear subtitles cache');
    } else {
      toast.success('Cached subtitles cleared');
      fetchStats();
    }
  };

  const deleteCacheItem = async (id: string) => {
    const { error } = await supabase
      .from('cached_streams')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete cache item');
    } else {
      toast.success('Cache item deleted');
      fetchCacheList();
      fetchStats();
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = (u.username || '').toLowerCase().includes(userSearch.toLowerCase()) || 
                            (u.id || '').toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, userRoleFilter]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      return logLevelFilter === 'all' || l.level === logLevelFilter;
    });
  }, [logs, logLevelFilter]);

  // Filtered Cached Streams
  const filteredCachedStreams = useMemo(() => {
    return cachedStreams.filter(c => {
      return (c.media_id || '').toLowerCase().includes(cacheSearch.toLowerCase()) ||
             (c.source_name || '').toLowerCase().includes(cacheSearch.toLowerCase());
    });
  }, [cachedStreams, cacheSearch]);

  if (adminStatus === 'loading') {
    return (
      <div className="min-h-screen bg-void pt-24 px-4 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="text-accent-green mx-auto mb-4 animate-spin" size={48} />
          <h1 className="text-xl font-bold text-white mb-2">Verifying Admin Access...</h1>
          <p className="text-text-secondary text-sm">Checking permissions with Supabase</p>
        </div>
      </div>
    );
  }

  if (adminStatus === 'unauthorized') {
    return (
      <div className="min-h-screen bg-void pt-24 px-4 flex items-center justify-center">
        <div className="text-center">
          <Shield className="text-accent-red mx-auto mb-4" size={48} />
          <h1 className="text-2xl font-bold text-white mb-2">Unauthorized Access</h1>
          <p className="text-text-secondary">You must be signed in as an admin to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void pt-24 px-4 md:px-12 pb-12 text-white">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
              <Shield className="text-accent-green" size={32} />
              Admin Dashboard
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Manage users, check error logs, and control caching configurations.
            </p>
          </div>
          
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-white/10 text-white rounded-lg border border-border transition-all text-sm font-semibold cursor-pointer"
          >
            <RefreshCw size={16} />
            Refresh Data
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between">
            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Total Users</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-bold font-display">{statsLoading ? '...' : stats.totalUsers}</span>
              <UserIcon className="text-text-muted" size={20} />
            </div>
            <span className="text-[10px] text-text-muted mt-1">{statsLoading ? '' : `${stats.adminsCount} administrators`}</span>
          </div>

          <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between">
            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">System Logs</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-bold font-display text-accent-red">{statsLoading ? '...' : stats.logsCount}</span>
              <Activity className="text-text-muted" size={20} />
            </div>
            <span className="text-[10px] text-text-muted mt-1">Errors and events tracked</span>
          </div>

          <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between">
            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Cached Streams</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-bold font-display text-accent-green">{statsLoading ? '...' : stats.cacheStreamsCount}</span>
              <Database className="text-text-muted" size={20} />
            </div>
            <span className="text-[10px] text-text-muted mt-1">High-speed cached video feeds</span>
          </div>

          <div className="bg-surface p-5 rounded-xl border border-border flex flex-col justify-between">
            <span className="text-xs text-text-secondary font-bold uppercase tracking-wider">Cached Subtitles</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-bold font-display text-accent-gold">{statsLoading ? '...' : stats.cacheSubtitlesCount}</span>
              <Server className="text-text-muted" size={20} />
            </div>
            <span className="text-[10px] text-text-muted mt-1">Cached SRT/VTT profiles</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl mb-6 max-w-2xl">
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2 text-center rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'users' ? 'bg-white text-black' : 'text-text-secondary hover:text-white'
            }`}
          >
            User Database
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-2 text-center rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'logs' ? 'bg-white text-black' : 'text-text-secondary hover:text-white'
            }`}
          >
            System Logs
          </button>
          <button 
            onClick={() => setActiveTab('cache')}
            className={`flex-1 py-2 text-center rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'cache' ? 'bg-white text-black' : 'text-text-secondary hover:text-white'
            }`}
          >
            Cache & Storage
          </button>
          <button 
            onClick={() => setActiveTab('ads')}
            className={`flex-1 py-2 text-center rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'ads' ? 'bg-white text-black' : 'text-text-secondary hover:text-white'
            }`}
          >
            Ads Manager
          </button>
        </div>

        {/* TAB 1: USER DATABASE */}
        {activeTab === 'users' && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* Filters Row */}
            <div className="p-4 md:p-6 border-b border-border flex flex-col sm:flex-row gap-3 justify-between items-center bg-void/30">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 text-text-muted" size={16} />
                <input 
                  type="text" 
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by username or ID..."
                  className="w-full bg-void border border-border rounded-lg pl-9 pr-4 py-2 text-xs md:text-sm text-white outline-none focus:border-accent-green transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Filter className="text-text-secondary" size={16} />
                <select 
                  value={userRoleFilter}
                  onChange={(e: any) => setUserRoleFilter(e.target.value)}
                  className="bg-void border border-border rounded-lg px-3 py-2 text-xs md:text-sm text-white outline-none cursor-pointer focus:border-accent-green"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Administrators</option>
                  <option value="moderator">Moderators</option>
                  <option value="user">Standard Users</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            {usersLoading ? (
              <div className="p-12 text-center text-text-secondary flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-accent-green" />
                <span>Loading user profiles...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-void/50 text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                      <th className="p-4 font-semibold">User Details</th>
                      <th className="p-4 font-semibold">User ID</th>
                      <th className="p-4 font-semibold">Joined Date</th>
                      <th className="p-4 font-semibold">Role Badge</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs md:text-sm">
                    {filteredUsers.map((profile) => (
                      <tr key={profile.id} className="hover:bg-void/10 transition-colors">
                        <td className="p-4 text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-void flex items-center justify-center text-text-secondary border border-border overflow-hidden">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={16} />
                            )}
                          </div>
                          <span className="font-bold">{profile.username || 'Unknown User'}</span>
                        </td>
                        <td className="p-4 text-text-muted font-mono text-[11px] max-w-[150px] truncate">{profile.id}</td>
                        <td className="p-4 text-text-secondary">
                          {new Date(profile.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            profile.role === 'admin' 
                              ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                              : profile.role === 'moderator'
                              ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                              : 'bg-void text-text-secondary border border-border'
                          }`}>
                            {profile.role || 'user'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {adminUserId && profile.id !== adminUserId ? (
                            <select
                              value={profile.role}
                              onChange={(e) => changeUserRole(profile.id, e.target.value)}
                              className="px-2 py-1.5 bg-void hover:bg-surface text-text-secondary hover:text-white text-xs font-semibold rounded-lg border border-border outline-none cursor-pointer"
                            >
                              <option value="user">User</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className="text-[10px] text-text-muted pr-2">Current User</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-text-secondary">
                          No users matched your query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SYSTEM LOGS */}
        {activeTab === 'logs' && (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {/* Action Bar */}
            <div className="p-4 md:p-6 border-b border-border flex flex-col sm:flex-row gap-3 justify-between items-center bg-void/30">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="text-text-secondary" size={16} />
                <select 
                  value={logLevelFilter}
                  onChange={(e: any) => setLogLevelFilter(e.target.value)}
                  className="bg-void border border-border rounded-lg px-3 py-2 text-xs md:text-sm text-white outline-none cursor-pointer focus:border-accent-green"
                >
                  <option value="all">All Levels</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                  <option value="fatal">Fatal</option>
                </select>
              </div>

              <button 
                onClick={purgeLogs}
                className="w-full sm:w-auto px-4 py-2 bg-accent-red/20 hover:bg-accent-red/30 text-accent-red hover:text-white rounded-lg border border-accent-red/30 transition-all text-xs font-bold flex items-center gap-1.5 justify-center cursor-pointer"
              >
                <Trash2 size={14} />
                Purge All Logs
              </button>
            </div>

            {/* Logs Table */}
            {logsLoading ? (
              <div className="p-12 text-center text-text-secondary flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-accent-green" />
                <span>Loading system logs...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-void/50 text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                      <th className="p-4 font-semibold w-24">Level</th>
                      <th className="p-4 font-semibold w-36">Context</th>
                      <th className="p-4 font-semibold">Message</th>
                      <th className="p-4 font-semibold w-40">Date Tracked</th>
                      <th className="p-4 font-semibold text-right w-20">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs font-mono">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-void/10 transition-colors">
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            log.level === 'fatal' || log.level === 'error'
                              ? 'bg-accent-red/10 text-accent-red border border-accent-red/20'
                              : log.level === 'warn'
                              ? 'bg-accent-gold/10 text-accent-gold border border-accent-gold/20'
                              : 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                          }`}>
                            {log.level === 'error' || log.level === 'fatal' ? <AlertTriangle size={8} /> : 
                             log.level === 'warn' ? <AlertTriangle size={8} /> : <CheckCircle size={8} />}
                            {log.level}
                          </span>
                        </td>
                        <td className="p-4 text-white font-bold">{log.context}</td>
                        <td className="p-4 text-text-secondary max-w-xs truncate">{log.message}</td>
                        <td className="p-4 text-text-muted text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1 hover:bg-surface text-text-secondary hover:text-white rounded transition-colors cursor-pointer"
                          >
                            <ArrowRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-text-secondary font-sans">
                          No logs found matching filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CACHE & STORAGE */}
        {activeTab === 'cache' && (
          <div className="space-y-6">
            
            {/* Cache Control Actions Card */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Database className="text-accent-green" size={20} />
                Global Storage Operations
              </h3>
              <p className="text-text-secondary text-xs mb-6">
                Purge aggregated streaming lists, video file references, or subtitle profiles cached in the DB.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-void/40 border border-border rounded-xl flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <Film size={16} className="text-accent-green" />
                      Video Stream Cache
                    </h4>
                    <p className="text-text-muted text-xs mt-1">
                      Contains extracted m3u8 playlists and MP4 media urls. Clean this if stream targets are broken or outdated.
                    </p>
                  </div>
                  <button 
                    onClick={purgeCacheStreams}
                    className="mt-4 px-4 py-2 bg-surface hover:bg-white/10 text-white rounded-lg border border-border text-xs font-semibold cursor-pointer text-center transition-all w-full"
                  >
                    Clear Stream Cache
                  </button>
                </div>

                <div className="p-4 bg-void/40 border border-border rounded-xl flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
                      <BookOpen size={16} className="text-accent-gold" />
                      Subtitle Profile Cache
                    </h4>
                    <p className="text-text-muted text-xs mt-1">
                      Cached external subtitle configurations, indexed references, and metadata.
                    </p>
                  </div>
                  <button 
                    onClick={purgeCacheSubtitles}
                    className="mt-4 px-4 py-2 bg-surface hover:bg-white/10 text-white rounded-lg border border-border text-xs font-semibold cursor-pointer text-center transition-all w-full"
                  >
                    Clear Subtitle Cache
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Cache Streams Table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <div className="p-4 md:p-6 border-b border-border flex flex-col sm:flex-row gap-3 justify-between items-center bg-void/30">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server size={16} className="text-text-secondary" />
                  Recent Cached Streams (Lookup)
                </h3>
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-2.5 text-text-muted" size={14} />
                  <input 
                    type="text" 
                    value={cacheSearch}
                    onChange={(e) => setCacheSearch(e.target.value)}
                    placeholder="Search by Media ID..."
                    className="w-full bg-void border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-white outline-none focus:border-accent-green transition-colors"
                  />
                </div>
              </div>

              {cacheLoading ? (
                <div className="p-12 text-center text-text-secondary flex flex-col items-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-accent-green" />
                  <span>Loading recent cache instances...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-void/50 text-text-secondary uppercase tracking-wider border-b border-border">
                        <th className="p-4 font-semibold">Media ID</th>
                        <th className="p-4 font-semibold">S / E</th>
                        <th className="p-4 font-semibold">Source Provider</th>
                        <th className="p-4 font-semibold">Language</th>
                        <th className="p-4 font-semibold">Format</th>
                        <th className="p-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 text-text-secondary">
                      {filteredCachedStreams.map((item) => (
                        <tr key={item.id} className="hover:bg-void/10 transition-colors">
                          <td className="p-4 text-white font-semibold font-mono">{item.media_id}</td>
                          <td className="p-4 font-mono">S{item.season} E{item.episode}</td>
                          <td className="p-4 font-bold">{item.source_name}</td>
                          <td className="p-4">
                            <span className="px-1.5 py-0.5 rounded bg-void border border-border text-[10px] uppercase font-bold">
                              {item.language}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-text-muted">{item.video_type}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => deleteCacheItem(item.id)}
                              className="p-1.5 bg-void hover:bg-accent-red/20 text-text-secondary hover:text-accent-red rounded border border-border hover:border-accent-red/30 transition-all cursor-pointer"
                              title="Delete Specific Cache Item"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredCachedStreams.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-text-secondary">
                            No cached items matched your query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ADS MANAGER */}
        {activeTab === 'ads' && (
          <AdsManager />
        )}

      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex justify-between items-center bg-void/25">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                  selectedLog.level === 'fatal' || selectedLog.level === 'error'
                    ? 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                    : selectedLog.level === 'warn'
                    ? 'bg-accent-gold/20 text-accent-gold border border-accent-gold/30'
                    : 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                }`}>
                  {selectedLog.level}
                </span>
                <h3 className="font-bold text-base text-white">{selectedLog.context}</h3>
              </div>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-text-secondary hover:text-white transition-colors cursor-pointer text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto font-mono text-xs text-text-secondary">
              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Message</span>
                <p className="bg-void p-3 rounded-lg border border-border text-white whitespace-pre-wrap">{selectedLog.message}</p>
              </div>

              {selectedLog.media_id && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Associated Media ID</span>
                  <code className="bg-void px-2 py-1 rounded border border-border text-accent-green">{selectedLog.media_id}</code>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Timestamp</span>
                <span>{new Date(selectedLog.created_at).toString()}</span>
              </div>

              {selectedLog.stack_trace && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-text-muted block mb-1">Stack Trace</span>
                  <pre className="bg-void p-4 rounded-lg border border-border overflow-x-auto text-[11px] text-accent-red/90 leading-relaxed max-h-60 overflow-y-auto">
                    {selectedLog.stack_trace}
                  </pre>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-void/10 flex justify-end">
              <button 
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white text-black font-semibold text-xs rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
