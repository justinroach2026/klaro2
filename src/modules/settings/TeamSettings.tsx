import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Mail, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { useStore } from '../../store';
import {
    createTeamInvite, getTeamMembers, inviteLink, listTeamInvites, memberName, revokeTeamInvite, setManager,
    type TeamInvite, type TeamMember,
} from '../../lib/review';

const inputClass = 'w-full p-3 border border-gray-200 rounded-xl text-sm text-text focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all';

export default function TeamSettings() {
    const { user, profile, setProfile } = useStore();
    const isCreator = !profile?.role || profile.role === 'creator';

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [invites, setInvites] = useState<TeamInvite[]>([]);
    const [managerId, setManagerId] = useState<string>('');
    const [managerStatus, setManagerStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [error, setError] = useState<string | null>(null);

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'creator' | 'viewer'>('creator');
    const [isInviting, setIsInviting] = useState(false);
    const [newLink, setNewLink] = useState<{ email: string; url: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const load = useCallback(async () => {
        try {
            const team = await getTeamMembers();
            setMembers(team);
            setManagerId(team.find(m => m.id === user?.id)?.manager_id ?? '');
            if (isCreator) setInvites(await listTeamInvites());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load your team');
        }
    }, [user?.id, isCreator]);

    useEffect(() => { void load(); }, [load]);

    const saveManager = async (value: string) => {
        if (!user) return;
        setManagerId(value);
        setManagerStatus('saving');
        setError(null);
        try {
            await setManager(user.id, value || null);
            if (profile) setProfile({ ...profile, manager_id: value || null });
            setManagerStatus('saved');
            setTimeout(() => setManagerStatus('idle'), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save your manager');
            setManagerStatus('idle');
            void load();
        }
    };

    const sendInvite = async () => {
        setIsInviting(true);
        setError(null);
        try {
            const email = inviteEmail.trim();
            const token = await createTeamInvite(email, inviteRole);
            setNewLink({ email, url: inviteLink(token) });
            setInviteEmail('');
            setInvites(await listTeamInvites());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create the invite');
        } finally {
            setIsInviting(false);
        }
    };

    const copyLink = async () => {
        if (!newLink) return;
        try {
            await navigator.clipboard.writeText(newLink.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError('Copy failed. Select the link and copy it manually.');
        }
    };

    const revoke = async (id: string) => {
        try {
            await revokeTeamInvite(id);
            setInvites(await listTeamInvites());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not withdraw the invite');
        }
    };

    const others = members.filter(m => m.id !== user?.id);
    const openInvites = invites.filter(i => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date());
    const mailto = newLink
        ? `mailto:${encodeURIComponent(newLink.email)}?subject=${encodeURIComponent('Join our team on Klaro')}&body=${encodeURIComponent(
            `Hi,\n\nYou've been invited to join our team on Klaro, where we keep our standard operating procedures.\n\nOpen this link and sign in (or create an account) with ${newLink.email}:\n${newLink.url}\n\nThe link works once and expires in 14 days.`)}`
        : '';

    return (
        <>
            {error && (
                <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>
            )}

            <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-text">Who is your manager?</h2>
                        <p className="text-xs text-text-lighter">SOPs you write, and changes you make to approved SOPs, go to them for approval</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={managerId}
                        onChange={e => void saveManager(e.target.value)}
                        disabled={managerStatus === 'saving'}
                        className={inputClass}
                        aria-label="Your manager"
                    >
                        <option value="">No manager (I approve my own SOPs)</option>
                        {others.map(m => (
                            <option key={m.id} value={m.id}>{memberName(m)}{m.email && m.full_name ? ` (${m.email})` : ''}</option>
                        ))}
                    </select>
                    {managerStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
                    {managerStatus === 'saved' && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                </div>
                {others.length === 0 && (
                    <p className="text-xs text-text-lighter mt-3">
                        Nobody else is on your team yet. {isCreator ? 'Invite your manager below' : 'Ask your manager to invite you'}, then choose them here.
                    </p>
                )}
            </section>

            <section className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="font-bold text-text">Team</h2>
                        <p className="text-xs text-text-lighter">{members.length} member{members.length === 1 ? '' : 's'}</p>
                    </div>
                </div>

                <ul className="divide-y divide-gray-100 mb-5">
                    {members.map(m => (
                        <li key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                                <p className="font-semibold text-text truncate">{memberName(m)}{m.id === user?.id && ' (you)'}</p>
                                <p className="text-xs text-text-lighter truncate">
                                    {m.email}{m.manager_id ? ` · reports to ${memberName(members.find(x => x.id === m.manager_id))}` : ''}
                                </p>
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0 ${m.role === 'creator' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                {m.role}
                            </span>
                        </li>
                    ))}
                </ul>

                {isCreator && (
                    <>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                placeholder="colleague@company.com"
                                className={inputClass}
                                aria-label="Email to invite"
                            />
                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'creator' | 'viewer')} className={`${inputClass} sm:w-40`} aria-label="Role">
                                <option value="creator">Creator</option>
                                <option value="viewer">Viewer</option>
                            </select>
                            <button
                                onClick={() => void sendInvite()}
                                disabled={isInviting || !inviteEmail.trim()}
                                className="btn-primary flex items-center justify-center gap-2 text-sm whitespace-nowrap disabled:opacity-50"
                            >
                                {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                Create invite
                            </button>
                        </div>
                        <p className="text-xs text-text-lighter mt-2">Creators write and approve SOPs; viewers read them and can suggest edits.</p>

                        {newLink && (
                            <div className="mt-4 p-4 rounded-xl bg-sky-50 border border-sky-200">
                                <p className="text-sm font-semibold text-sky-900">Invite for {newLink.email} is ready. Send them this link:</p>
                                <div className="flex gap-2 mt-2">
                                    <input readOnly value={newLink.url} onFocus={e => e.target.select()} className={`${inputClass} font-mono text-xs bg-white`} aria-label="Invite link" />
                                    <button onClick={() => void copyLink()} className="px-3 rounded-xl bg-white border border-gray-200 text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50">
                                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                        {copied ? 'Copied' : 'Copy'}
                                    </button>
                                    <a href={mailto} className="px-3 rounded-xl bg-white border border-gray-200 text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50">
                                        <Mail className="w-4 h-4" /> Email
                                    </a>
                                </div>
                                <p className="text-xs text-sky-800 mt-2">Shown once. It works only for that email address, once, for 14 days.</p>
                            </div>
                        )}

                        {openInvites.length > 0 && (
                            <div className="mt-5">
                                <p className="text-xs font-bold text-text-lighter uppercase tracking-wider mb-2">Pending invites</p>
                                <ul className="space-y-2">
                                    {openInvites.map(i => (
                                        <li key={i.id} className="flex items-center justify-between gap-3 text-sm p-2.5 rounded-xl bg-gray-50">
                                            <span className="truncate">{i.email} <span className="text-xs text-text-lighter">· {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}</span></span>
                                            <button onClick={() => void revoke(i.id)} className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1 flex-shrink-0">
                                                <X className="w-3.5 h-3.5" /> Withdraw
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}
            </section>
        </>
    );
}
