import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle } from 'lucide-react';

// Landing page for links emailed by Supabase (confirmation + magic link).
// The client is created with detectSessionInUrl, so it consumes the tokens from
// the URL on load; we just wait for the resulting session and route onwards.
export default function AuthCallback() {
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Supabase reports link failures (expired, already used) in the URL itself,
        // as query params for PKCE and hash fragments for the implicit flow.
        const params = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const urlError = params.get('error_description') || hash.get('error_description');
        if (urlError) {
            setError(urlError);
            return;
        }

        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            window.history.replaceState({}, '', window.location.pathname);
            navigate('/dashboard', { replace: true });
        };

        supabase?.auth.getSession().then(({ data: { session } }) => {
            if (session) done();
        });

        const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
            if (session) done();
        }) || { data: { subscription: null } };

        const timeout = setTimeout(() => {
            if (!settled) setError('This link is invalid or has expired. Please request a new one.');
        }, 8000);

        return () => {
            subscription?.unsubscribe();
            clearTimeout(timeout);
        };
    }, [navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 text-center">
                {error ? (
                    <>
                        <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Link problem</h1>
                        <p className="text-gray-500 mb-8 leading-relaxed">{error}</p>
                        <button
                            onClick={() => navigate('/auth', { replace: true })}
                            className="w-full py-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-[#137fec]/30"
                        >
                            Return to Sign In
                        </button>
                    </>
                ) : (
                    <>
                        <Loader2 className="w-10 h-10 text-[#137fec] animate-spin mx-auto mb-8" />
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Signing you in</h1>
                        <p className="text-gray-500 leading-relaxed">Just a moment while we confirm your link.</p>
                    </>
                )}
            </div>
        </div>
    );
}
