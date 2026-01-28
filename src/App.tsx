import { useEffect, useState } from 'react';
import { useStore } from './store';
import { supabase } from './lib/supabase';
import LanguageSelector from './components/LanguageSelector';
import ModeSelector from './components/ModeSelector';
import DriveMode from './pages/DriveMode';
import OfficeMode from './pages/OfficeMode';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import SOPViewer from './pages/SOPViewer';
import './index.css';

type View = 'auth' | 'dashboard' | 'language' | 'mode' | 'interview' | 'viewer';

function App() {
  const [currentView, setCurrentView] = useState<View>('auth');
  const [selectedSop, setSelectedSop] = useState<any>(null);
  const { setUser, interviewMode } = useStore();

  // Handle auth session
  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) setCurrentView('dashboard');
    });

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setCurrentView('dashboard');
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
    setCurrentView('mode');
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
        />
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
