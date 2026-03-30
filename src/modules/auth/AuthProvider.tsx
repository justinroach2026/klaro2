import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { supabase, getProfile } from '../../lib/supabase';
import { useStore } from '../../store';

export default function AuthProvider() {
    const { setUser, setProfile, setTeam, setSelectedLanguage, setSelectedIndustry, setSelectedCountry, setIsAuthLoading } = useStore();

    const loadProfile = async (userId: string) => {
        try {
            const profile = await getProfile(userId);
            if (profile) {
                setProfile(profile);
                if (profile.teams) setTeam(profile.teams as any);
                if (profile.language_preference) setSelectedLanguage(profile.language_preference as any);
                if (profile.industry) setSelectedIndustry(profile.industry as any);
                if (profile.country) setSelectedCountry(profile.country as any);
            }
        } catch (err) {
            console.error('Error loading profile:', err);
        }
    };

    useEffect(() => {
        supabase?.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) loadProfile(session.user.id);
            setIsAuthLoading(false);
        });

        const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) loadProfile(session.user.id);
        }) || { data: { subscription: null } };

        return () => subscription?.unsubscribe();
    }, []);

    return <Outlet />;
}
