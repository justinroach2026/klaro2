import { useState } from 'react';
import { markSOPReviewed, updateSOPOwnership } from '../lib/supabase';
import { useStore } from '../store';
import {
    User,
    CalendarClock,
    CheckCircle2,
    AlertTriangle,
    ChevronDown,
    Shield,
    Clock
} from 'lucide-react';

interface OwnershipPanelProps {
    sopId: string;
    ownerId: string | null;
    ownerName?: string;
    reviewIntervalDays: number | null;
    lastReviewedAt: string | null;
    nextReviewAt: string | null;
    onUpdate?: () => void;
    compact?: boolean;
}

const REVIEW_OPTIONS = [
    { label: 'Every 30 days', value: 30 },
    { label: 'Every 60 days', value: 60 },
    { label: 'Every 90 days', value: 90 },
    { label: 'Every 180 days', value: 180 },
    { label: 'Annually', value: 365 },
    { label: 'No schedule', value: null },
];

export default function OwnershipPanel({
    sopId,
    ownerId,
    ownerName,
    reviewIntervalDays,
    lastReviewedAt,
    nextReviewAt,
    onUpdate,
    compact = false
}: OwnershipPanelProps) {
    const { user } = useStore();
    const [isMarkingReviewed, setIsMarkingReviewed] = useState(false);
    const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
    const [localInterval, setLocalInterval] = useState(reviewIntervalDays);
    const [localLastReviewed, setLocalLastReviewed] = useState(lastReviewedAt);
    const [justReviewed, setJustReviewed] = useState(false);

    const isOverdue = nextReviewAt && new Date(nextReviewAt) < new Date();
    const daysOverdue = nextReviewAt
        ? Math.max(0, Math.floor((Date.now() - new Date(nextReviewAt).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
    const isOwner = ownerId === user?.id;
    const isTemplate = sopId.startsWith('template-');

    const handleMarkReviewed = async () => {
        if (isTemplate) return;
        setIsMarkingReviewed(true);
        try {
            await markSOPReviewed(sopId);
            setLocalLastReviewed(new Date().toISOString());
            setJustReviewed(true);
            setTimeout(() => setJustReviewed(false), 3000);
            onUpdate?.();
        } catch (err) {
            console.error('Failed to mark reviewed:', err);
        } finally {
            setIsMarkingReviewed(false);
        }
    };

    const handleSetSchedule = async (days: number | null) => {
        if (isTemplate) return;
        setShowScheduleDropdown(false);
        try {
            await updateSOPOwnership(sopId, {
                review_interval_days: days,
            });
            setLocalInterval(days);
            onUpdate?.();
        } catch (err) {
            console.error('Failed to set schedule:', err);
        }
    };

    const handleClaimOwnership = async () => {
        if (!user || isTemplate) return;
        try {
            await updateSOPOwnership(sopId, { owner_id: user.id });
            onUpdate?.();
        } catch (err) {
            console.error('Failed to claim ownership:', err);
        }
    };

    if (isTemplate) return null;

    return (
        <div className={`rounded-2xl border transition-all ${
            isOverdue && !justReviewed
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-white/8 bg-white/3'
        } ${compact ? 'p-4' : 'p-6'}`}>
            <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-[#137fec]" />
                <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Ownership & Review</span>
            </div>

            {/* Owner */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-[#137fec]/15 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-[#137fec]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/30 font-bold">Owner</p>
                    <p className="text-sm text-white/80 font-bold truncate">
                        {ownerName || (isOwner ? 'You' : ownerId ? 'Team member' : 'Unassigned')}
                    </p>
                </div>
                {!ownerId && (
                    <button
                        onClick={handleClaimOwnership}
                        className="text-xs text-[#137fec] font-bold hover:underline"
                    >
                        Claim
                    </button>
                )}
            </div>

            {/* Review schedule */}
            <div className="flex items-center gap-3 mb-4 relative">
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CalendarClock className="w-4 h-4 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/30 font-bold">Review Schedule</p>
                    <button
                        onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
                        className="text-sm text-white/70 font-bold flex items-center gap-1 hover:text-white transition-colors"
                    >
                        {localInterval ? `Every ${localInterval} days` : 'No schedule set'}
                        <ChevronDown className="w-3 h-3" />
                    </button>
                </div>

                {showScheduleDropdown && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowScheduleDropdown(false)} />
                        <div className="absolute left-0 top-full mt-1 w-52 bg-[#1a1a1f] border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                            {REVIEW_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => handleSetSchedule(opt.value)}
                                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                        localInterval === opt.value
                                            ? 'text-[#137fec] font-bold bg-[#137fec]/8'
                                            : 'text-white/60 hover:bg-white/5 hover:text-white/80'
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
                <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/30 font-bold">Last Reviewed</p>
                    <p className="text-sm text-white/70 font-bold">
                        {localLastReviewed
                            ? new Date(localLastReviewed).toLocaleDateString()
                            : 'Never reviewed'}
                    </p>
                </div>
            </div>

            {/* Overdue warning */}
            {isOverdue && !justReviewed && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-300 font-bold">
                        Overdue by {daysOverdue} day{daysOverdue !== 1 ? 's' : ''}
                    </span>
                </div>
            )}

            {/* Just reviewed success */}
            {justReviewed && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-4">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-xs text-green-300 font-bold">Marked as reviewed</span>
                </div>
            )}

            {/* Mark reviewed button */}
            {isOwner && (
                <button
                    onClick={handleMarkReviewed}
                    disabled={isMarkingReviewed}
                    className="w-full py-3 rounded-xl bg-[#137fec]/10 hover:bg-[#137fec]/20 text-[#137fec] font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    {isMarkingReviewed ? 'Updating…' : 'Mark as Reviewed'}
                </button>
            )}
        </div>
    );
}
