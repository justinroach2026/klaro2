import { useEffect, useState } from 'react';
import { useStore } from './store';
import { supabase, getProfile, updateProfile } from './lib/supabase';
import LanguageSelector from './components/LanguageSelector';
import ModeSelector from './components/ModeSelector';
import DriveMode from './pages/DriveMode';
import OfficeMode from './pages/OfficeMode';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SOPViewer from './pages/SOPViewer';
import IndustrySelector from './components/IndustrySelector';
import CountrySelector from './components/CountrySelector';
import ResearchPanel from './components/ResearchPanel';
import Settings from './pages/Settings';
import './index.css';

type View = 'auth' | 'dashboard' | 'settings' | 'language' | 'country' | 'industry' | 'research' | 'mode' | 'interview' | 'viewer';

function App() {
  const [currentView, setCurrentView] = useState<View>('auth');
  const [selectedSop, setSelectedSop] = useState<any>(null);
  const { user, setUser, setProfile, setSelectedLanguage, setSelectedIndustry, setSelectedCountry, interviewMode, theme } = useStore();

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
      if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };
    applyTheme(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Load profile on auth and restore saved preferences
  const loadProfile = async (userId: string) => {
    try {
      const profile = await getProfile(userId);
      if (profile) {
        setProfile(profile);
        if (profile.language_preference) setSelectedLanguage(profile.language_preference as any);
        if (profile.industry) setSelectedIndustry(profile.industry as any);
        if (profile.country) setSelectedCountry(profile.country as any);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  // Handle auth session
  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setCurrentView('dashboard');
        loadProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setCurrentView('dashboard');
        loadProfile(session.user.id);
      } else {
        setCurrentView('auth');
      }
    }) || { data: { subscription: null } };

    return () => subscription?.unsubscribe();
  }, [setUser]);

  const handleStartInterview = () => {
    setCurrentView('language');
  };

  const handleLanguageSelected = () => {
    setCurrentView('country');
  };

  const handleCountrySelected = () => {
    setCurrentView('industry');
  };

  const handleIndustrySelected = async () => {
    if (user) {
      try {
        const { selectedIndustry, selectedCountry, selectedLanguage } = useStore.getState();
        await updateProfile(user.id, {
          industry: selectedIndustry,
          country: selectedCountry,
          language_preference: selectedLanguage
        });
        const updatedProfile = await getProfile(user.id);
        setProfile(updatedProfile);
      } catch (err) {
        console.error('Error saving profile:', err);
      }
    }
    setCurrentView('research');
  };

  const handleModeSelected = () => {
    setCurrentView('interview');
  };

  const handleViewSop = (sop: any) => {
    setSelectedSop(sop);
    setCurrentView('viewer');
  };

  return (
    <div className="min-h-screen bg-background-alt font-sans">
      {/* Auth View */}
      {currentView === 'auth' && <Auth />}

      {/* Dashboard View */}
      {currentView === 'dashboard' && (
        <Dashboard
          onNewSOP={handleStartInterview}
          onViewSOP={handleViewSop}
          onSettings={() => setCurrentView('settings')}
        />
      )}

      {/* Settings View */}
      {currentView === 'settings' && (
        <Settings onBack={() => setCurrentView('dashboard')} />
      )}

      {/* Language Selection */}
      {currentView === 'language' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <LanguageSelector />
          <div className="w-full max-w-md mt-6 flex gap-3 px-6">
            <button
              onClick={() => setCurrentView('dashboard')}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleLanguageSelected}
              className="btn-primary flex-1"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Country Selection */}
      {currentView === 'country' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <CountrySelector />
          <div className="w-full max-w-md mt-6 flex gap-3 px-6">
            <button
              onClick={() => setCurrentView('language')}
              className="btn-secondary flex-1"
            >
              Back
            </button>
            <button
              onClick={handleCountrySelected}
              className="btn-primary flex-1"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Industry Selection */}
      {currentView === 'industry' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <IndustrySelector />
          <div className="w-full max-w-md mt-6 flex gap-3 px-6">
            <button
              onClick={() => setCurrentView('country')}
              className="btn-secondary flex-1"
            >
              Back
            </button>
            <button
              onClick={handleIndustrySelected}
              className="btn-primary flex-1"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Research View */}
      {currentView === 'research' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <ResearchPanel onContinue={() => setCurrentView('mode')} onBack={() => setCurrentView('industry')} />
        </div>
      )}

      {/* Mode Selection */}
      {currentView === 'mode' && (
        <div className="min-h-screen flex flex-col items-center justify-center">
          <ModeSelector onContinue={handleModeSelected} />
        </div>
      )}

      {/* Interview View */}
      {currentView === 'interview' && (
        <div className="fixed inset-0 z-50">
          {interviewMode === 'drive' ? (
            <DriveMode />
          ) : (
            <OfficeMode />
          )}

          {/* Exit Interview Button (Subtle overlay) */}
          <button
            onClick={() => setCurrentView('dashboard')}
            className="fixed top-6 left-6 z-[60] p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white/60 transition-colors"
          >
            <ExitIcon className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Viewer View */}
      {currentView === 'viewer' && selectedSop && (
        <SOPViewer
          sop={selectedSop}
          onBack={() => setCurrentView('dashboard')}
        />
      )}
    </div>
  );
}

function ExitIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default App;
