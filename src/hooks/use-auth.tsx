'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: any | null;
  society: any | null;
  signOut: () => Promise<void>;
  refreshSociety: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<any | null>(null);
  const [society, setSociety] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const supabase = createClient();

  const fetchProfileAndSociety = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(profileData);

    if (profileData?.society_id) {
      const { data: societyData } = await supabase
        .from('societies')
        .select('*')
        .eq('id', profileData.society_id)
        .single();
      setSociety(societyData);
    } else {
      setSociety(null);
    }
    return profileData;
  };

  // Expose a way to re-fetch society data after an update (e.g. after setup wizard)
  const refreshSociety = async () => {
    if (!user) return;
    await fetchProfileAndSociety(user.id);
  };

  React.useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfileAndSociety(session.user.id);
      }
      setLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfileAndSociety(session.user.id);
      } else {
        setProfile(null);
        setSociety(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error('Error signing out', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, society, loading, signOut, refreshSociety }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
