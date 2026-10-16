import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import AuthProvider from './modules/auth/AuthProvider';
import AuthGuard from './modules/auth/AuthGuard';
import Auth from './modules/auth/Auth';
import AuthCallback from './modules/auth/AuthCallback';
import ResetPassword from './modules/auth/ResetPassword';
import Dashboard from './modules/dashboard/Dashboard';
import Settings from './modules/settings/Settings';
import InterviewPage from './modules/interview/InterviewPage';
import SOPViewer from './modules/sop/SOPViewer';
import RecordingPage from './modules/recording/RecordingPage';

function App() {
  const { theme } = useStore();

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

  return (
    <div className="min-h-screen bg-[#09090b] font-sans">
      <Routes>
        <Route element={<AuthProvider />}>
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<AuthGuard />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/interview" element={<InterviewPage />} />
            <Route path="/recording" element={<RecordingPage />} />
            <Route path="/sop/:id" element={<SOPViewer />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
