import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('useAuth: Initializing auth state');
    
    // Listen for auth changes FIRST (synchronous only!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('useAuth: Auth state changed', event, !!session?.user);
        setUser(session?.user ?? null);
        
        if (event === "PASSWORD_RECOVERY") {
          window.location.href = "/reset-password";
        }

        // Defer any Supabase calls to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            loadProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('useAuth: Initial session check', !!session?.user);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          loadProfile(session.user.id);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      console.log('useAuth: Loading profile for user:', userId);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('useAuth: Error loading profile:', error);
        setLoading(false);
        return;
      }
      
      console.log('useAuth: Profile query result:', { profile, hasProfile: !!profile });
      
      if (!profile) {
        // Profile doesn't exist, create a basic one
        console.log('useAuth: No profile found, creating new profile');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              role: 'customer',
              contact_type: 'primary',
              is_active: false,
            });
          
          if (!insertError) {
            console.log('useAuth: Profile created, reloading profile');
            // Reload the profile after creating it
            const { data: newProfile, error: newProfileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .maybeSingle();
            
            if (!newProfileError && newProfile) {
              console.log('useAuth: New profile loaded:', newProfile);
              setProfile(newProfile);
            } else {
              console.error('useAuth: Error loading new profile:', newProfileError);
            }
          } else {
            console.error('useAuth: Error creating profile:', insertError);
          }
        }
      } else {
        console.log('useAuth: Existing profile loaded:', profile);
        setProfile(profile);
      }
    } catch (error) {
      console.error('useAuth: Error loading profile:', error);
    } finally {
      console.log('useAuth: Setting loading to false');
      setLoading(false);
    }
  };

  return {
    user,
    profile,
    loading,
    isAuthenticated: !loading && !!user,
    isAdmin: !loading && profile?.role === 'admin',
    isSalesAdmin: !loading && (profile?.role === 'sales_admin' || profile?.role === 'admin'),
    refetch: () => user && loadProfile(user.id),
  };
}
