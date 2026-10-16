import { useState } from 'react';
import { updateSOPOwnership } from '../lib/supabase';
import { claimSop, markSopReviewed, memberName, canClaim, isReviewOverdue, type TeamMember, type WorkflowFields } from '../lib/review';
import { useStore } from '../store';
import {
    User,
    CalendarClock,
    CheckCircle2,
    AlertTriangle,
    ChevronDown,
    Shield,
    Clock,
    Loader2,
} from 'lucide-react';

interface OwnershipPanelProps {
    sop: WorkflowFields & { id: string; status?: string };
    members: TeamMember[];
    onChange: (updated: Partial<WorkflowFields>) => void;
    onError?: (message: string | null) => void;
}

const REVIEW_OPTIONS = [
    { label: 'Every 30 days', value: 30 },
    { label: 'Every 60 days', value: 60 },
    { label: 'Every 90 days', value: 90 },
    { label: 'Every 180 days', value: 180 },
    { label: 'Annually', value: 365 },
    { label: 'No schedule', value: null },
];

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default function OwnershipPanel({ sop, members, onChange, onError }: OwnershipPanelProps) {
    const { user } = useStore();
    const [busy, setBusy] = useState<'claim' | 'review' | 'schedule' | null>(null);
    const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
    const [justReviewed, setJustReviewed] = useState(false);

    const isTemplate = sop.id.startsWith('template-');
    const isOwner = !!user && sop.owner_id === user.id;
    const overdue = sop.status !== 'draft' && isReviewOverdue(sop) && !justReviewed;
    const daysOverdue = sop.next_review_at
        ? Math.max(0, Math.floor((Date.now() - new Date(sop.next_review_at).getTime()) / 86400000))
        : 0;
    const owner = members.find(m => m.id === sop.owner_id);
    const ownerLabel = isOwner ? 'You' : sop.owner_id ? memberName(owner, 'Team member') : 'Unassigned';
    const author = members.find(m => m.id === sop.created_by);
    const eligibleToClaim = canClaim(sop, user?.id, members);

    const run = async (kind: 'claim' | 'review' | 'schedule', fn: () => Promise<Partial<WorkflowFields>>) => {
        setBusy(kind);
        onError?.(null);
        try {
            onChange(await fn());
            return true;
        } catch (err) {
            onError?.(err instanceof Error ? err.message : 'Something went wrong');
            return false;
        } finally {
            setBusy(null);
        }
    };

    const handleMarkReviewed = async () => {
        if (await run('review', () => markSopReviewed<WorkflowFields>(sop.id))) {
            setJustReviewed(true);
            setTimeout(() => setJustReviewed(false), 3000);
        }
    };

    const handleSetSchedule = (days: number | null) => {
        setShowScheduleDropdown(false);
        // The database recomputes next_review_at and returns the updated row.
        void run('schedule', () => updateSOPOwnership(sop.id, { review_interval_days: days }));
    };

    if (isTemplate) return null;

    const tone = overdue
        ? 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
        : 'border-gray-100 bg-white dark:border-white/8 dark:bg-white/3';

    return (
        <div className={`rounded-2xl border shadow-sm transition-all p-6 ${tone}`}>
            <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-[#137fec]" />
                <span className="text-xs font-bold text-gray-500 dark:text-white/50 uppercase tracking-widest">Ownership & Review</span>
            </div>

            {/* Owner */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#137fec]/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#137fec]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 dark:text-white/30 font-bold">Owner & approver</p>
                    <p className="text-sm text-gray-800 dark:text-white/80 font-bold truncate">{ownerLabel}</p>
                    {!sop.owner_id && (
                        <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">
                            {author?.manager_id
                                ? `To be claimed by ${memberName(members.find(m => m.id === author.manager_id), 'the author’s manager')}`
                                : 'To be claimed by the author (no manager set)'}
                        </p>
                    )}
                </div>
                {eligibleToClaim && (
                    <button
                        onClick={() => void run('claim', () => claimSop<WorkflowFields>(sop.id))}
                        disabled={busy !== null}
                        className="px-3 py-1.5 rounded-lg bg-[#137fec] text-white text-xs font-bold hover:bg-[#0f66bd] disabled:opacity-40 flex items-center gap-1"
                        title="Take ownership and approve this SOP"
                    >
                        {busy === 'claim' && <Loader2 className="w-3 h-3 animate-spin" />}
                        Claim
                    </button>
                )}
            </div>

            {/* Review schedule */}
            <div className="flex items-center gap-3 mb-4 relative">
                <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CalendarClock className="w-4 h-4 text-gray-400 dark:text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 dark:text-white/30 font-bold">Review Schedule</p>
                    {isOwner ? (
                        <button
                            onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                            className="text-sm text-gray-700 dark:text-white/70 font-bold flex items-center gap-1 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            {sop.review_interval_days ? `Every ${sop.review_interval_days} days` : 'No schedule set'}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                    ) : (
                        <p className="text-sm text-gray-700 dark:text-white/70 font-bold">
                            {sop.review_interval_days ? `Every ${sop.review_interval_days} days` : 'No schedule set'}
                        </p>
                    )}
                    {sop.next_review_at && (
                        <p className={`text-[11px] mt-0.5 ${overdue ? 'text-red-600 dark:text-red-300 font-bold' : 'text-gray-500 dark:text-white/40'}`}>
                            Next review {fmt(sop.next_review_at)}
                        </p>
                    )}
                </div>

                {showScheduleDropdown && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowScheduleDropdown(false)} />
                        <div className="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-[#1a1a1f] border border-gray-100 dark:border-white/10 rounded-xl shadow-2xl py-1 z-50">
                            {REVIEW_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => handleSetSchedule(opt.value)}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                        sop.review_interval_days === opt.value
                                            ? 'text-[#137fec] font-bold bg-[#137fec]/8'
                                            : 'text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white/80'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Last reviewed */}
            <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-gray-400 dark:text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 dark:text-white/30 font-bold">Last Reviewed</p>
                    <p className="text-sm text-gray-700 dark:text-white/70 font-bold">
                        {sop.last_reviewed_at ? fmt(sop.last_reviewed_at) : sop.approved_at ? `Approved ${fmt(sop.approved_at)}` : 'Never reviewed'}
                    </p>
                </div>
            </div>

            {overdue && (
                <div className="flex items-center gap-2 p-3 bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25 rounded-xl mb-4">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-300 flex-shrink-0" />
                    <span className="text-xs text-red-700 dark:text-red-200 font-bold">
                        Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
                    </span>
                </div>
            )}

            {justReviewed && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl mb-4">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="text-xs text-green-700 dark:text-green-300 font-bold">Marked as reviewed</span>
                </div>
            )}

            {isOwner && sop.status !== 'draft' && (
                <button
                    onClick={handleMarkReviewed}
                    disabled={busy !== null}
                    className="w-full py-3 rounded-xl bg-[#137fec]/10 hover:bg-[#137fec]/20 text-[#137fec] font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    {busy === 'review' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {busy === 'review' ? 'Updating…' : 'Mark as Reviewed'}
                </button>
            )}
        </div>
    );
}
