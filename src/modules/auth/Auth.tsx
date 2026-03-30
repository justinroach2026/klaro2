import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithMagicLink, signInWithPassword, signUpWithPassword, resetPasswordForEmail } from '../../lib/supabase';
import { useStore } from '../../store';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft, UserPlus, Eye, EyeOff, Zap } from 'lucide-react';

const MAGIC_LINK_COOLDOWN_SECONDS = 60;

type AuthMode = 'signin' | 'signup' | 'forgot' | 'magic';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [mode, setMode] = useState<AuthMode>('signin');
    const [magicLinkCooldown, setMagicLinkCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { setError, error: storeError, user } = useStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/dashboard', { replace: true });
    }, [user, navigate]);

    useEffect(() => {
        return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
    }, []);

    const startMagicLinkCooldown = () => {
        setMagicLinkCooldown(MAGIC_LINK_COOLDOWN_SECONDS);
        cooldownRef.current = setInterval(() => {
            setMagicLinkCooldown(prev => {
                if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mode === 'magic' && magicLinkCooldown > 0) return;
        setLoading(true);
        setError(null);
        try {
            if (mode === 'signin') {
                await signInWithPassword(email, password);
            } else if (mode === 'signup') {
                await signUpWithPassword(email, password);
                setSent(true);
            } else if (mode === 'forgot') {
                await resetPasswordForEmail(email);
                setSent(true);
            } else if (mode === 'magic') {
                await signInWithMagicLink(email);
                startMagicLinkCooldown();
                setSent(true);
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-4">Check your email</h1>
                    <p className="text-gray-500 mb-8 leading-relaxed">
                        {mode === 'forgot'
                            ? "We've sent password reset instructions to "
                            : mode === 'signup'
                                ? "We've sent a confirmation link to "
                                : "We've sent a magic link to "}
                        <span className="font-semibold text-gray-800">{email}</span>.
                    </p>
                    <button
                        onClick={() => { setSent(false); setMode('signin'); }}
                        className="w-full py-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-[#137fec]/30"
                    >
                        Return to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400">
            <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
                    <Zap className="w-5 h-5 text-[#137fec]" fill="currentColor" />
                </div>
                <span className="text-xl font-black text-white tracking-tight drop-shadow">Klaro</span>
            </div>

            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-14 h-14 bg-[#137fec]/10 rounded-2xl flex items-center justify-center mb-6">
                        {mode === 'signup' ? <UserPlus className="w-7 h-7 text-[#137fec]" /> : <Mail className="w-7 h-7 text-[#137fec]" />}
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight text-center">
                        {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Magic link'}
                    </h1>
                    <p className="text-gray-500 text-center mt-2 text-sm">
                        {mode === 'signin' ? 'Sign in to continue to Klaro' : mode === 'signup' ? 'Join Klaro and start documenting' : mode === 'forgot' ? 'Enter your email to reset your password' : 'Enter your email for a passwordless login'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                id="email"
                                type="email"
                                required
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec] transition-all outline-none text-sm"
                            />
                        </div>
                    </div>

                    {(mode === 'signin' || mode === 'signup') && (
                        <div>
                            <div className="flex justify-between mb-2">
                                <label htmlFor="password" className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Password
                                </label>
                                {mode === 'signin' && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('forgot')}
                                        className="text-xs font-semibold text-[#137fec] hover:text-[#0f66bd] transition-colors"
                                    >
                                        Forgot?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
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
                    )}

                    {storeError && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <p className="leading-relaxed">{storeError}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || (mode === 'magic' && magicLinkCooldown > 0)}
                        className="w-full py-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-[#137fec]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
                        ) : mode === 'magic' && magicLinkCooldown > 0 ? (
                            `Resend in ${magicLinkCooldown}s`
                        ) : (
                            mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Get Started' : mode === 'forgot' ? 'Send Reset Link' : 'Send Magic Link'
                        )}
                    </button>
                </form>

                <div className="mt-6 space-y-3">
                    {mode === 'signin' && (
                        <>
                            <button
                                onClick={() => setMode('magic')}
                                className="w-full py-3.5 border border-gray-200 rounded-xl text-gray-500 font-semibold hover:bg-gray-50 hover:text-gray-700 transition-all text-sm"
                            >
                                Sign in with Magic Link
                            </button>
                            <p className="text-center text-sm text-gray-400">
                                Don't have an account?{' '}
                                <button
                                    onClick={() => setMode('signup')}
                                    className="text-[#137fec] font-bold hover:text-[#0f66bd] transition-colors"
                                >
                                    Sign up
                                </button>
                            </p>
                        </>
                    )}

                    {mode !== 'signin' && (
                        <button
                            onClick={() => { setMode('signin'); setError(null); }}
                            className="w-full py-3 flex items-center justify-center gap-2 text-gray-400 font-medium hover:text-gray-600 transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Sign In
                        </button>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400 leading-relaxed">
                        By continuing, you agree to our <a href="#" className="underline hover:text-gray-600 transition-colors">Terms</a> and <a href="#" className="underline hover:text-gray-600 transition-colors">Privacy Policy</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
