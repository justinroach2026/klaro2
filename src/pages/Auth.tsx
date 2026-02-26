import { useState } from 'react';
import { signInWithMagicLink, signInWithPassword, signUpWithPassword, resetPasswordForEmail } from '../lib/supabase';
import { useStore } from '../store';
import { Mail, Lock, Loader2, CheckCircle2, AlertCircle, ArrowLeft, UserPlus, Eye, EyeOff } from 'lucide-react';

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
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 text-center border border-slate-100">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-slate-900 mb-4">Check your email</h1>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        {mode === 'forgot'
                            ? "We've sent password reset instructions to "
                            : mode === 'signup'
                                ? "We've sent a confirmation link to "
                                : "We've sent a magic link to "}
                        <span className="font-semibold text-slate-900">{email}</span>.
                    </p>
                    <button
                        onClick={() => {
                            setSent(false);
                            setMode('signin');
                        }}
                        className="btn-primary w-full py-4 rounded-xl font-semibold shadow-lg shadow-blue-500/20"
                    >
                        Return to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10 border border-slate-100">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30 transform rotate-3">
                        {mode === 'signup' ? <UserPlus className="w-8 h-8 text-white" /> : <Mail className="w-8 h-8 text-white" />}
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-slate-900">
                        {mode === 'signin' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Magic Link'}
                    </h1>
                    <p className="text-slate-500 text-center mt-3 font-medium">
                        {mode === 'signin' ? 'Sign in to continue to Klaro' : mode === 'signup' ? 'Join Klaro and start documenting' : mode === 'forgot' ? 'Enter your email to reset your password' : 'Enter your email for a passwordless login'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-6">
                    {(mode === 'signin' || mode === 'signup' || mode === 'forgot' || mode === 'magic') && (
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2 ml-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {(mode === 'signin' || mode === 'signup') && (
                        <div>
                            <div className="flex justify-between mb-2 ml-1">
                                <label htmlFor="password" className="text-sm font-semibold text-slate-700">
                                    Password
                                </label>
                                {mode === 'signin' && (
                                    <button
                                        type="button"
                                        onClick={() => setMode('forgot')}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                                    >
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {storeError && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 text-red-700 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="leading-relaxed font-medium">{storeError}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-4 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin mr-3" />
                                Processing...
                            </>
                        ) : (
                            mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Get Started' : mode === 'forgot' ? 'Send Reset Link' : 'Send Magic Link'
                        )}
                    </button>
                </form>

                <div className="mt-8 space-y-4">
                    {mode === 'signin' && (
                        <>
                            <button
                                onClick={() => setMode('magic')}
                                className="w-full py-3.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Sign in with Magic Link
                            </button>
                            <p className="text-center text-sm text-slate-500">
                                Don't have an account?{' '}
                                <button
                                    onClick={() => setMode('signup')}
                                    className="text-blue-600 font-bold hover:underline"
                                >
                                    Sign up
                                </button>
                            </p>
                        </>
                    )}

                    {mode !== 'signin' && (
                        <button
                            onClick={() => {
                                setMode('signin');
                                setError(null);
                            }}
                            className="w-full py-3.5 flex items-center justify-center gap-2 text-slate-500 font-semibold hover:text-slate-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Sign In
                        </button>
                    )}
                </div>

                <div className="mt-10 pt-8 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        By continuing, you agree to our <a href="#" className="underline">Terms of Service</a> and <a href="#" className="underline">Privacy Policy</a>.
                    </p>
                </div>
            </div>
        </div>
    );
}
