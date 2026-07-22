import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, updatePassword } from '../../lib/supabase';
import { Lock, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

// Target of the password-reset email. The recovery link puts a short-lived
// session in place, which is what authorises the updateUser call below.
export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const urlError = params.get('error_description') || hash.get('error_description');
        if (urlError) {
            setError(urlError);
            return;
        }

        supabase?.auth.getSession().then(({ data: { session } }) => {
            if (session) setReady(true);
        });

        const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
            if (session) setReady(true);
        }) || { data: { subscription: null } };

        const timeout = setTimeout(() => {
            setReady(current => {
                if (!current) setError('This reset link is invalid or has expired. Please request a new one.');
                return current;
            });
        }, 8000);

        return () => {
            subscription?.unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await updatePassword(password);
            window.history.replaceState({}, '', window.location.pathname);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not update password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-14 h-14 bg-[#137fec]/10 rounded-2xl flex items-center justify-center mb-6">
                        <Lock className="w-7 h-7 text-[#137fec]" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight text-center">Set a new password</h1>
                    <p className="text-gray-500 text-center mt-2 text-sm">Choose a new password for your account</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={6}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec] transition-all outline-none text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirm" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                id="confirm"
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={6}
                                placeholder="••••••••"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec] transition-all outline-none text-sm"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <p className="leading-relaxed">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !ready}
                        className="w-full py-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-[#137fec]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            'Update Password'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
