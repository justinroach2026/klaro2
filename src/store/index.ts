import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

// Supported languages
export const SUPPORTED_LANGUAGES = {
    en: { code: 'en-US', name: 'English', nativeName: 'English' },
    es: { code: 'es-ES', name: 'Spanish', nativeName: 'Español' },
    nl: { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands' },
    fr: { code: 'fr-FR', name: 'French', nativeName: 'Français' },
    de: { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
    it: { code: 'it-IT', name: 'Italian', nativeName: 'Italiano' },
    pt: { code: 'pt-PT', name: 'Portuguese', nativeName: 'Português' },
    pl: { code: 'pl-PL', name: 'Polish', nativeName: 'Polski' },
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

interface Profile {
    id: string;
    team_id: string;
    full_name: string | null;
    language_preference: string;
}

interface Team {
    id: string;
    name: string;
    logo_url: string | null;
    subscription_status: string;
    trial_ends_at: string | null;
}

interface InterviewMessage {
    role: 'user' | 'ai';
    content: string;
    timestamp: number;
}

interface AppState {
    // Auth state
    user: User | null;
    profile: Profile | null;
    team: Team | null;
    setUser: (user: User | null) => void;
    setProfile: (profile: Profile | null) => void;
    setTeam: (team: Team | null) => void;

    // Interview state
    interviewMode: 'drive' | 'office' | null;
    selectedLanguage: LanguageCode;
    interviewMessages: InterviewMessage[];
    isRecording: boolean;
    isSpeaking: boolean;
    sessionId: string | null;

    setInterviewMode: (mode: 'drive' | 'office' | null) => void;
    setSelectedLanguage: (lang: LanguageCode) => void;
    addMessage: (message: Omit<InterviewMessage, 'timestamp'>) => void;
    clearMessages: () => void;
    setIsRecording: (recording: boolean) => void;
    setIsSpeaking: (speaking: boolean) => void;
    setSessionId: (id: string | null) => void;

    // UI state
    isLoading: boolean;
    error: string | null;
    setIsLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
    // Auth state
    user: null,
    profile: null,
    team: null,
    setUser: (user) => set({ user }),
    setProfile: (profile) => set({ profile }),
    setTeam: (team) => set({ team }),

    // Interview state
    interviewMode: null,
    selectedLanguage: 'en',
    interviewMessages: [],
    isRecording: false,
    isSpeaking: false,
    sessionId: null,

    setInterviewMode: (mode) => set({ interviewMode: mode }),
    setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
    addMessage: (message) =>
        set((state) => ({
            interviewMessages: [
                ...state.interviewMessages,
                { ...message, timestamp: Date.now() },
            ],
        })),
    clearMessages: () => set({ interviewMessages: [] }),
    setIsRecording: (recording) => set({ isRecording: recording }),
    setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
    setSessionId: (id) => set({ sessionId: id }),

    // UI state
    isLoading: false,
    error: null,
    setIsLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
}));
