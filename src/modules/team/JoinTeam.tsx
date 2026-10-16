import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, TriangleAlert, Users } from 'lucide-react';
import { useStore } from '../../store';
import { getProfile } from '../../lib/supabase';
import { acceptTeamInvite, forgetInvite, rememberInvite } from '../../lib/review';

type Phase = 'ready' | 'joining' | 'joined' | 'error';

export default function JoinTeam() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const navigate = useNavigate();
    const { user, isAuthLoading, setProfile, setTeam } = useStore();
    const [phase, setPhase] = useState<Phase>('ready');
    const [error, setError] = useState<string | null>(null);

    // Signed out: keep the token and send them to sign in or create an account first.
    useEffect(() => {
        if (isAuthLoading || !token) return;
        if (!user) {
            rememberInvite(token);
            navigate('/auth', { replace: true });
        }
    }, [isAuthLoading, user, token, navigate]);

    const join = async () => {
        if (!user) return;
        setPhase('joining');
        setError(null);
        try {
            await acceptTeamInvite(token);
            forgetInvite();
            const profile = await getProfile(user.id);
            if (profile) {
                setProfile(profile);
                if (profile.teams) setTeam(profile.teams);
            }
            setPhase('joined');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not join the team');
            setPhase('error');
        }
    };

    const decline = () => {
        forgetInvite();
        navigate('/dashboard', { replace: true });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-8">
                <div className="w-12 h-12 rounded-2xl bg-[#137fec]/10 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-[#137fec]" />
                </div>

                {!token ? (
                    <>
                        <h1 className="text-2xl font-black text-gray-900">Invite link missing</h1>
                        <p className="text-gray-600 text-sm mt-2">Open the full link from your invite, or ask your manager to send a new one.</p>
                    </>
                ) : !user ? (
                    <div className="flex items-center gap-2 text-gray-600 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Taking you to sign in…</div>
                ) : phase === 'joined' ? (
                    <>
                        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                            <CheckCircle2 className="w-6 h-6 text-green-600" /> You've joined the team
                        </h1>
                        <p className="text-gray-600 text-sm mt-2">
                            Next, open Settings and choose who your manager is, so your SOPs go to them for approval.
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => navigate('/settings', { replace: true })} className="flex-1 py-3 rounded-xl bg-[#137fec] text-white font-bold text-sm hover:bg-[#0f66bd]">
                                Set my manager
                            </button>
                            <button onClick={() => navigate('/dashboard', { replace: true })} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50">
                                Dashboard
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h1 className="text-2xl font-black text-gray-900">Join your team on Klaro</h1>
                        <p className="text-gray-600 text-sm mt-2">
                            You'll see and work on your team's SOPs. If this account has its own SOPs and nobody else is in your current team, they move with you.
                        </p>
                        <p className="text-gray-500 text-xs mt-3">Signed in as <strong>{user.email}</strong>. The invite only works for the address it was sent to.</p>
                        {error && (
                            <p role="alert" className="flex gap-2 mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                                <TriangleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
                            </p>
                        )}
                        <div className="flex gap-3 mt-6">
                            <button onClick={decline} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50">
                                Not now
                            </button>
                            <button
                                onClick={() => void join()}
                                disabled={phase === 'joining'}
                                className="flex-1 py-3 rounded-xl bg-[#137fec] text-white font-bold text-sm hover:bg-[#0f66bd] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {phase === 'joining' && <Loader2 className="w-4 h-4 animate-spin" />}
                                Join team
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
