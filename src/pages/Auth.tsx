import { useState } from 'react';
import { signInWithMagicLink, signInWithPassword, signUpWithPassword, resetPasswordForEmail } from '../lib/supabase';
import { useStore } from '../store';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft, UserPlus, Eye, EyeOff, Zap } from 'lucide-react';

type AuthMode = 'signin' | 'signup' | 'forgot' | 'magic';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [mode, setMode] = useState<AuthMode>('signin');
    const { setError, error: storeError } = useStore();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
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
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#09090b]">
                {/* Background glow */}
                <div className="fixed inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-[#137fec]/10 rounded-full blur-[120px]" />
                </div>
                <div className="relative w-full max-w-md bg-[#121214]/80 backdrop-blur-xl border border-white/8 rounded-3xl shadow-2xl p-10 text-center">
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-4">Check your email</h1>
                    <p className="text-white/50 mb-8 leading-relaxed">
                        {mode === 'forgot'
                            ? "We've sent password reset instructions to "
                            : mode === 'signup'
                                ? "We've sent a confirmation link to "
                                : "We've sent a magic link to "}
                        <span className="font-semibold text-white/80">{email}</span>.
                    </p>
                    <button
                        onClick={() => { setSent(false); setMode('signin'); }}
                        className="w-full py-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-[#137fec]/20"
                    >
                        Return to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#09090b]">
            {/* Background glows */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[800px] h-[600px] bg-[#137fec]/10 rounded-full blur-[140px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-700/8 rounded-full blur-[100px]" />
            </div>

            {/* Logo mark */}
            <div className="relative flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-[#137fec] rounded-xl flex items-center justify-center shadow-lg shadow-[#137fec]/30">
                    <Zap className="w-5 h-5 text-white" fill="currentColor" />
                </div>
                <span className="text-xl font-black text-white tracking-tight">Klaro</span>
            </div>

            <div className="relative w-full max-w-md bg-[#121214]/80 backdrop-blur-xl border border-white/8 rounded-3xl shadow-2xl p-10">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-14 h-14 bg-[#137fec]/10 border border-[#137fec]/20 rounded-2xl flex items-center justify-center mb-6">
                        {mode === 'signup' ? <UserPlus className="w-7 h-7 text-[#137fec]" /> : <Mail className="w-7 h-7 text-[#137fec]" />}
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight text-center">
                        {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Reset password' : 'Magic link'}
                    </h1>
                    <p className="text-white/40 text-center mt-2 text-sm">
                        {mode === 'signin' ? 'Sign in to continue to Klaro' : mode === 'signup' ? 'Join Klaro and start documenting' : mode === 'forgot' ? 'Enter your email to reset your password' : 'Enter your email for a passwordless login'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                id="email"
                                type="email"
                                required
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/8 rounded-xl text-white placeholder:text-white/25 focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec]/50 transition-all outline-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    {(mode === 'signin' || mode === 'signup') && (
                        <div>
                            <div className="flex justify-between mb-2">
                                <label htmlFor="password" className="text-xs font-bold text-white/40 uppercase tracking-widest">
                                    Password
                                </label>
                                {mode === 'signin' && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('forgot')}
                                        className="text-xs font-semibold text-[#137fec] hover:text-[#429bf0] transition-colors"
                                    >
                                        Forgot?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-12 py-3.5 bg-white/5 border border-white/8 rounded-xl text-white placeholder:text-white/25 focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec]/50 transition-all outline-none text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {storeError && (
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <p className="leading-relaxed">{storeError}</p>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl bg-[#137fec] hover:bg-[#0f66bd] text-white font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-[#137fec]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                            </>
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
                                className="w-full py-3.5 border border-white/8 rounded-xl text-white/50 font-semibold hover:bg-white/5 hover:text-white/70 transition-all text-sm"
                            >
                                Sign in with Magic Link
                            </button>
                            <p className="text-center text-sm text-white/30">
                                Don't have an account?{' '}
                                <button
                                    onClick={() => setMode('signup')}
                                    className="text-[#137fec] font-bold hover:text-[#429bf0] transition-colors"
                                >
                                    Sign up
                                </button>
                            </p>
                        </>
                    )}

                    {mode !== 'signin' && (
                        <button
                            onClick={() => { setMode('signin'); setError(null); }}
                            className="w-full py-3 flex items-center justify-center gap-2 text-white/30 font-medium hover:text-white/60 transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Sign In
                        </button>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-xs text-white/20 leading-relaxed">
                        By continuing, you agree to our <a href="#" className="underline hover:text-white/40 transition-colors">Terms</a> and <a href="#" className="underline hover:text-white/40 transition-colors">Privacy Policy</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
