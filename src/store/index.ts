import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { SOPTemplate } from '../lib/templates';

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

// Supported industries
export const SUPPORTED_INDUSTRIES = {
    tech: { name: 'Technology & Software', icon: 'Code', description: 'Software development, SaaS, and IT services.' },
    healthcare: { name: 'Healthcare & Medical', icon: 'Stethoscope', description: 'Medical clinics, hospitals, and health services.' },
    hospitality: { name: 'Hospitality & Tourism', icon: 'Hotel', description: 'Hotels, restaurants, and travel agencies.' },
    manufacturing: { name: 'Manufacturing & Logistics', icon: 'Factory', description: 'Production lines, warehousing, and shipping.' },
    professional: { name: 'Professional Services', icon: 'Briefcase', description: 'Legal, accounting, consulting, and finance.' },
    education: { name: 'Education & Training', icon: 'GraduationCap', description: 'Schools, universities, and corporate training.' },
    retail: { name: 'Retail & E-commerce', icon: 'ShoppingBag', description: 'Online shops and brick-and-mortar stores.' },
    construction: { name: 'Construction & Development', icon: 'HardHat', description: 'Building projects, infrastructure, and heavy construction.' },
    real_estate: { name: 'Real Estate', icon: 'Building', description: 'Property management, sales, leasing, and appraisal.' },
    other: { name: 'Other / General', icon: 'Layout', description: 'General business processes and operations.' },
} as const;

export type IndustryCode = keyof typeof SUPPORTED_INDUSTRIES;

// Supported countries — EMEA first rollout, plus key global markets
export const SUPPORTED_COUNTRIES = {
    // Europe
    gb: { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP', region: 'Europe' },
    ie: { name: 'Ireland', flag: '🇮🇪', currency: 'EUR', region: 'Europe' },
    fr: { name: 'France', flag: '🇫🇷', currency: 'EUR', region: 'Europe' },
    de: { name: 'Germany', flag: '🇩🇪', currency: 'EUR', region: 'Europe' },
    nl: { name: 'Netherlands', flag: '🇳🇱', currency: 'EUR', region: 'Europe' },
    be: { name: 'Belgium', flag: '🇧🇪', currency: 'EUR', region: 'Europe' },
    es: { name: 'Spain', flag: '🇪🇸', currency: 'EUR', region: 'Europe' },
    pt: { name: 'Portugal', flag: '🇵🇹', currency: 'EUR', region: 'Europe' },
    it: { name: 'Italy', flag: '🇮🇹', currency: 'EUR', region: 'Europe' },
    ch: { name: 'Switzerland', flag: '🇨🇭', currency: 'CHF', region: 'Europe' },
    at: { name: 'Austria', flag: '🇦🇹', currency: 'EUR', region: 'Europe' },
    se: { name: 'Sweden', flag: '🇸🇪', currency: 'SEK', region: 'Europe' },
    no: { name: 'Norway', flag: '🇳🇴', currency: 'NOK', region: 'Europe' },
    dk: { name: 'Denmark', flag: '🇩🇰', currency: 'DKK', region: 'Europe' },
    fi: { name: 'Finland', flag: '🇫🇮', currency: 'EUR', region: 'Europe' },
    pl: { name: 'Poland', flag: '🇵🇱', currency: 'PLN', region: 'Europe' },
    cz: { name: 'Czech Republic', flag: '🇨🇿', currency: 'CZK', region: 'Europe' },
    gr: { name: 'Greece', flag: '🇬🇷', currency: 'EUR', region: 'Europe' },
    // Middle East
    ae: { name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED', region: 'Middle East' },
    sa: { name: 'Saudi Arabia', flag: '🇸🇦', currency: 'SAR', region: 'Middle East' },
    qa: { name: 'Qatar', flag: '🇶🇦', currency: 'QAR', region: 'Middle East' },
    il: { name: 'Israel', flag: '🇮🇱', currency: 'ILS', region: 'Middle East' },
    // Africa
    za: { name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', region: 'Africa' },
    ng: { name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', region: 'Africa' },
    ke: { name: 'Kenya', flag: '🇰🇪', currency: 'KES', region: 'Africa' },
    eg: { name: 'Egypt', flag: '🇪🇬', currency: 'EGP', region: 'Africa' },
    // Global
    us: { name: 'United States', flag: '🇺🇸', currency: 'USD', region: 'Americas' },
    ca: { name: 'Canada', flag: '🇨🇦', currency: 'CAD', region: 'Americas' },
    au: { name: 'Australia', flag: '🇦🇺', currency: 'AUD', region: 'Asia-Pacific' },
} as const;

export type CountryCode = keyof typeof SUPPORTED_COUNTRIES;

interface Profile {
    id: string;
    team_id: string;
    full_name: string | null;
    language_preference: string;
    role?: 'creator' | 'viewer';
    industry?: IndustryCode;
    country?: CountryCode;
    agentic_prompt?: string;
    company_name?: string;
    company_logo_url?: string;
    company_website?: string;
    company_email?: string;
    company_phone?: string;
    company_address?: string;
}

interface Team {
    id: string;
    name: string;
    logo_url: string | null;
    subscription_status: string;
    trial_ends_at: string | null;
}

// Messages carrying image attachments are sent as multimodal content blocks
// rather than a plain string, so transcripts contain both shapes.
export type MessageContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } };

interface InterviewMessage {
    role: 'user' | 'ai';
    content: string | MessageContentPart[];
    timestamp: number;
    attachments?: string[];
}

// Flattens either content shape to plain text for display and titles.
export const messageText = (content: string | MessageContentPart[]): string =>
    typeof content === 'string'
        ? content
        : content.map(part => (part.type === 'text' ? part.text : '')).join('').trim();

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
    selectedIndustry: IndustryCode;
    selectedCountry: CountryCode;
    interviewMessages: InterviewMessage[];
    isRecording: boolean;
    isSpeaking: boolean;
    sessionId: string | null;

    selectedSOPTemplate: SOPTemplate | null;
    setSelectedSOPTemplate: (template: SOPTemplate | null) => void;

    setInterviewMode: (mode: 'drive' | 'office' | null) => void;
    setSelectedLanguage: (lang: LanguageCode) => void;
    setSelectedIndustry: (industry: IndustryCode) => void;
    setSelectedCountry: (country: CountryCode) => void;
    addMessage: (message: Omit<InterviewMessage, 'timestamp'>) => void;
    clearMessages: () => void;
    setIsRecording: (recording: boolean) => void;
    setIsSpeaking: (speaking: boolean) => void;
    setSessionId: (id: string | null) => void;

    // UI state
    theme: 'light' | 'dark' | 'system';
    isLoading: boolean;
    isAuthLoading: boolean;
    error: string | null;

    // Live SOP Draft state
    sopContent: string;
    pendingUpdate: string | null;
    sopHistory: string[];
    draftSOPId: string | null;
    autosaveStatus: 'idle' | 'saving' | 'saved';

    setTheme: (theme: 'light' | 'dark' | 'system') => void;
    setIsLoading: (loading: boolean) => void;
    setIsAuthLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    setSopContent: (content: string) => void;
    setPendingUpdate: (update: string | null) => void;
    setSopHistory: (history: string[] | ((prev: string[]) => string[])) => void;
    setDraftSOPId: (id: string | null) => void;
    setAutosaveStatus: (status: 'idle' | 'saving' | 'saved') => void;
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
    selectedIndustry: 'other',
    selectedCountry: 'gb',
    selectedSOPTemplate: null,
    setSelectedSOPTemplate: (template) => set({ selectedSOPTemplate: template }),
    interviewMessages: [],
    isRecording: false,
    isSpeaking: false,
    sessionId: null,

    setInterviewMode: (mode) => set({ interviewMode: mode }),
    setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
    setSelectedIndustry: (industry) => set({ selectedIndustry: industry }),
    setSelectedCountry: (country) => set({ selectedCountry: country }),
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
    theme: (localStorage.getItem('klaro-theme') as 'light' | 'dark' | 'system') || 'system',
    isLoading: false,
    isAuthLoading: true,
    error: null,

    sopContent: '',
    pendingUpdate: null,
    sopHistory: [],
    draftSOPId: null,
    autosaveStatus: 'idle',

    setTheme: (theme) => {
        localStorage.setItem('klaro-theme', theme);
        set({ theme });
    },
    setIsLoading: (loading) => set({ isLoading: loading }),
    setIsAuthLoading: (loading) => set({ isAuthLoading: loading }),
    setError: (error) => set({ error }),

    setSopContent: (content) => set({ sopContent: content }),
    setPendingUpdate: (update) => set({ pendingUpdate: update }),
    setSopHistory: (history) => set((state) => ({
        sopHistory: typeof history === 'function' ? history(state.sopHistory) : history
    })),
    setDraftSOPId: (id) => set({ draftSOPId: id }),
    setAutosaveStatus: (status) => set({ autosaveStatus: status }),
}));
