import { useState } from 'react';
import { signInWithMagicLink } from '../lib/supabase';
import { useStore } from '../store';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Auth() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { setError, error: storeError } = useStore();

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signInWithMagicLink(email);
            setSent(true);
        } catch (err: any) {
            setError(err.message || 'Failed to send magic link');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-alt">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-heading font-bold text-text mb-4">Check your email</h1>
                    <p className="text-text-light mb-8">
                        We've sent a magic link to <span className="font-semibold">{email}</span>.
                        Click the link in the email to sign in instantly.
                    </p>
                    <button
                        onClick={() => setSent(false)}
                        className="text-primary font-medium hover:underline"
                    >
                        Try another email
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-alt">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 transform rotate-6">
                        <Mail className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-text">Welcome to Klaro</h1>
                    <p className="text-text-light text-center mt-2">
                        Enter your email to sign in or create an account
                    </p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-text-light mb-2">
                            Email Address
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input-primary"
                        />
                    </div>

                    {storeError && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p>{storeError}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full flex items-center justify-center"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                Sending Link...
                            </>
                        ) : (
                            'Send Magic Link'
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-8 border-t border-gray-100 text-center">
                    <p className="text-xs text-text-lighter px-4">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                        No password needed!
                    </p>
                </div>
            </div>
        </div>
    );
}
