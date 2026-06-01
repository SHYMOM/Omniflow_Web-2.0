'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useUserStore } from '@/store/userStore';

/**
 * AuthProvider
 *
 * Subscribes to Supabase auth state changes and keeps the Zustand
 * user store in sync. Mount this once at the root layout so that:
 *   - On a hard page reload the store is re-hydrated from the live session.
 *   - After sign-in / sign-up the store is updated reactively.
 *   - After sign-out the store is cleared reactively.
 */
export default function AuthProvider() {
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    const supabase = createClient();

    // Bootstrap: load the current session immediately on mount
    const bootstrapUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url, role, created_at')
          .eq('id', user.id)
          .single();

        setUser({
          id: user.id,
          username: profile?.username || user.email?.split('@')[0] || 'User',
          avatarUrl: profile?.avatar_url ?? undefined,
          role: profile?.role || 'user',
          createdAt: profile?.created_at || user.created_at,
        });
      } else {
        setUser(null);
      }
    };

    bootstrapUser();

    // Reactive listener: keeps store in sync across tab focus, token refresh, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url, role, created_at')
            .eq('id', session.user.id)
            .single();

          setUser({
            id: session.user.id,
            username: profile?.username || session.user.email?.split('@')[0] || 'User',
            avatarUrl: profile?.avatar_url ?? undefined,
            role: profile?.role || 'user',
            createdAt: profile?.created_at || session.user.created_at,
          });
        } else {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [setUser]);

  // Renders nothing — purely for side-effects
  return null;
}
