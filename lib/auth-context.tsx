import { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

type AuthContextType = {
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    loading: true,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session with proper error handling
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setLoading(false);
            })
            .catch((error) => {
                console.warn('⚠️ Failed to get session (network may be unavailable):', error?.message);
                setSession(null);
                setLoading(false);
            });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('🔄 Auth state changed:', _event, !!session);
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signOut = async () => {
        console.log('🚪 Signing out from auth context...');
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.warn('⚠️ Sign out request failed (may be offline):', error);
        }
        setSession(null); // Always clear the session state even if network fails
        console.log('✅ Session cleared');
    };

    return (
        <AuthContext.Provider value={{ session, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
