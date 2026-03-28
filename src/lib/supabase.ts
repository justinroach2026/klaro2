import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create Supabase client with graceful failure for missing keys
export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    })
    : null;

if (!supabase) {
    console.warn('Supabase client not initialized: Missing environment variables');
}

// Database types (will be auto-generated from Supabase later)
export interface Database {
    public: {
        Tables: {
            teams: {
                Row: {
                    id: string;
                    name: string;
                    created_at: string;
                    stripe_customer_id: string | null;
                    stripe_subscription_id: string | null;
                    subscription_status: string;
                    trial_ends_at: string | null;
                    logo_url: string | null;
                };
                Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['teams']['Insert']>;
            };
            profiles: {
                Row: {
                    id: string;
                    team_id: string | null;
                    full_name: string | null;
                    language_preference: string;
                    industry: string | null;
                    country: string | null;
                    agentic_prompt: string | null;
                    role: 'creator' | 'viewer';
                    company_name: string | null;
                    company_logo_url: string | null;
                    company_website: string | null;
                    company_email: string | null;
                    company_phone: string | null;
                    company_address: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
            };
            sops: {
                Row: {
                    id: string;
                    team_id: string;
                    title: string;
                    content: string;
                    language: string;
                    tags: string[];
                    version: number;
                    change_summary: string | null;
                    created_by: string | null;
                    owner_id: string | null;
                    review_interval_days: number | null;
                    last_reviewed_at: string | null;
                    next_review_at: string | null;
                    related_sop_ids: string[];
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['sops']['Row'], 'id' | 'created_at' | 'updated_at' | 'next_review_at'>;
                Update: Partial<Database['public']['Tables']['sops']['Insert']>;
            };
            sop_history: {
                Row: {
                    id: string;
                    sop_id: string;
                    version: number;
                    title: string;
                    content: string;
                    tags: string[];
                    change_summary: string | null;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['sop_history']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['sop_history']['Insert']>;
            };
            interview_sessions: {
                Row: {
                    id: string;
                    team_id: string;
                    user_id: string;
                    mode: 'drive' | 'office';
                    language: string;
                    transcript: any[];
                    sop_id: string | null;
                    status: string;
                    created_at: string;
                    completed_at: string | null;
                };
                Insert: Omit<Database['public']['Tables']['interview_sessions']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['interview_sessions']['Insert']>;
            };
        };
    };
}

// Auth helpers
export const signInWithMagicLink = async (email: string) => {
    const { data, error } = await supabase?.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
    }) || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

export const signInWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase?.auth.signInWithPassword({
        email,
        password,
    }) || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

export const signUpWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase?.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
    }) || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

export const resetPasswordForEmail = async (email: string) => {
    const { data, error } = await supabase?.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
    }) || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

export const signOut = async () => {
    const { error } = await supabase?.auth.signOut() || { error: null };
    if (error) throw error;
};

export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase?.auth.getUser() || { data: { user: null }, error: null };
    if (error) throw error;
    return user;
};

export const getProfile = async (userId: string) => {
    const { data, error } = await supabase
        ?.from('profiles')
        .select('*, teams(*)')
        .eq('id', userId)
        .single() || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

export const updateProfile = async (userId: string, updates: any) => {
    const { data, error } = await supabase
        ?.from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single() || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

// ─── Process Integrity Helpers ──────────────────────────────────────────────

export const getOverdueSOPs = async (userId: string) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        ?.from('sops')
        .select('id, title, next_review_at, last_reviewed_at, review_interval_days, updated_at, version, owner_id')
        .eq('owner_id', userId)
        .not('next_review_at', 'is', null)
        .lte('next_review_at', now)
        .order('next_review_at', { ascending: true })
        || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data || [];
};

export const getRelatedSOPs = async (sopIds: string[]) => {
    if (!sopIds || sopIds.length === 0) return [];
    const { data, error } = await supabase
        ?.from('sops')
        .select('id, title, updated_at, version, language')
        .in('id', sopIds)
        || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data || [];
};

export const markSOPReviewed = async (sopId: string) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        ?.from('sops')
        .update({ last_reviewed_at: now })
        .eq('id', sopId)
        .select()
        .single()
        || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

export const updateSOPOwnership = async (sopId: string, updates: {
    owner_id?: string;
    review_interval_days?: number | null;
}) => {
    const { data, error } = await supabase
        ?.from('sops')
        .update(updates)
        .eq('id', sopId)
        .select()
        .single()
        || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};

export const updateSOPRelatedIds = async (sopId: string, relatedIds: string[]) => {
    const { data, error } = await supabase
        ?.from('sops')
        .update({ related_sop_ids: relatedIds })
        .eq('id', sopId)
        .select()
        .single()
        || { data: null, error: new Error('Supabase not initialized') };

    if (error) throw error;
    return data;
};
