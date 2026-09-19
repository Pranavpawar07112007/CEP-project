'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profile: any | null; // We can type this better later
  society: any | null;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<any | null>(null);
  const [society, setSociety] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();
  const supabase = createClient();

  React.useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
        if (profileData?.society_id) {
          const { data: societyData } = await supabase
            .from('societies')
            .select('*')
            .eq('id', profileData.society_id)
            .single();
          setSociety(societyData);
        }
      }
      setLoading(false);
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profileData);
        if (profileData?.society_id) {
          const { data: societyData } = await supabase
            .from('societies')
            .select('*')
            .eq('id', profileData.society_id)
            .single();
          setSociety(societyData);
        }
      } else {
        setProfile(null);
        setSociety(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error("Error signing out", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, society, loading, signOut }}>
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
