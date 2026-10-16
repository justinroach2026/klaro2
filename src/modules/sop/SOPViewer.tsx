import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { sopMarkdownProps } from '../../components/sopMarkdown';
import { useStore } from '../../store';
import { supabase, suggestSOPEdit, getPendingSuggestions, resolveSuggestion, publishSOP } from '../../lib/supabase';
import {
    SOP_SELECT, fetchSop, saveSopEdit, approveSop, requestSopChanges, getTeamMembers, memberName,
    hasPendingRevision, isReviewOverdue, type TeamMember, type WorkflowFields,
} from '../../lib/review';
import SOPHistoryPanel from '../../components/SOPHistoryPanel';
import MarkdownEditor from '../../components/MarkdownEditor';
import OwnershipPanel from '../../components/OwnershipPanel';
import SOPLinkPicker from '../../components/SOPLinkPicker';
import PDFRenderer from '../../components/PDFRenderer';
import {
    Download,
    ChevronLeft,
    History,
    Edit3,
    Eye,
    Save,
    CheckCircle2,
    Loader2,
    ShieldAlert,
    GitPullRequestDraft,
    Check,
    X as XIcon,
    Link as LinkIcon,
    AlertTriangle,
    CalendarX2,
    MessageSquareWarning,
    FileClock,
} from 'lucide-react';

type SopData = WorkflowFields & {
    id: string;
    title: string;
    content: string;
    language: string;
    updated_at: string;
    created_at: string;
    tags?: string[];
    version?: number;
    profiles?: { full_name: string };
    related_sop_ids?: string[] | null;
    status?: 'draft' | 'published';
};

export default function SOPViewer() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const [sopData, setSopData] = useState<SopData | null>(location.state?.sop || null);
    const [isFetching, setIsFetching] = useState(!location.state?.sop);

    useEffect(() => {
        if (sopData) return;
        if (!id) { navigate('/dashboard'); return; }

        supabase!
            .from('sops')
            .select(SOP_SELECT)
            .eq('id', id)
            .single()
            .then(({ data, error }) => {
                if (error || !data) { navigate('/dashboard'); return; }
                setSopData(data as unknown as SopData);
                setIsFetching(false);
            });
    }, [id]);

    if (isFetching) {
        return (
            <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#137fec] animate-spin" />
            </div>
        );
    }

    if (!sopData) return null;

    return <SOPViewerContent initialSop={sopData} onBack={() => navigate('/dashboard')} />;
}

function Banner({ tone, icon, title, children }: {
    tone: 'red' | 'amber' | 'blue';
    icon: React.ReactNode;
    title: string;
    children?: React.ReactNode;
}) {
    const tones = {
        red: 'bg-red-100 dark:bg-red-500/15 border-red-300 dark:border-red-500/30 text-red-900 dark:text-red-100',
        amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-100',
        blue: 'bg-blue-50 dark:bg-[#137fec]/10 border-blue-200 dark:border-[#137fec]/30 text-blue-900 dark:text-blue-100',
    };
    return (
        <div role="status" className={`flex gap-3 p-4 rounded-2xl border ${tones[tone]}`}>
            <span className="mt-0.5 flex-shrink-0">{icon}</span>
            <div className="min-w-0">
                <p className="font-bold text-sm">{title}</p>
                {children && <div className="text-sm mt-1 opacity-90">{children}</div>}
            </div>
        </div>
    );
}

function SOPViewerContent({ initialSop, onBack }: { initialSop: SopData; onBack: () => void }) {
    const { team, profile, user } = useStore();
    const [sop, setSop] = useState(initialSop);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(sop.content);
    const [editedTitle, setEditedTitle] = useState(sop.title);

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const [showLinkPicker, setShowLinkPicker] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [viewingSuggestionId, setViewingSuggestionId] = useState<string | null>(null);

    const [showPending, setShowPending] = useState(false);
    const [changesNote, setChangesNote] = useState('');
    const [showChangesForm, setShowChangesForm] = useState(false);
    const [isReviewing, setIsReviewing] = useState(false);

    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTemplate = sop.id.startsWith('template-');
    const isViewer = profile?.role === 'viewer';
    const isDraft = sop.status === 'draft';
    const [isPublishing, setIsPublishing] = useState(false);

    const isOwner = !!user && sop.owner_id === user.id;
    const pendingRevision = hasPendingRevision(sop);
    const overdue = !isDraft && isReviewOverdue(sop);
    const unapproved = !isDraft && sop.approval_status !== 'approved';
    const owner = members.find(m => m.id === sop.owner_id);
    const ownerLabel = memberName(owner, 'the SOP owner');
    const pendingAuthor = members.find(m => m.id === sop.pending_by);
    const iAmPendingAuthor = !!user && sop.pending_by === user.id;
    // Where an unowned SOP's approval would come from: the author's manager.
    const author = members.find(m => m.id === sop.created_by);
    const approverLabel = sop.owner_id ? ownerLabel : memberName(members.find(m => m.id === author?.manager_id), 'your line manager');

    // The base an edit starts from: a non-owner continues the pending revision if there is one.
    const editBase = useCallback(() => (
        !isOwner && pendingRevision
            ? { title: sop.pending_title ?? sop.title, content: sop.pending_content ?? sop.content }
            : { title: sop.title, content: sop.content }
    ), [isOwner, pendingRevision, sop]);

    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        getTeamMembers().then(setMembers).catch(err => console.error('Failed to load team:', err));
    }, []);

    const reload = useCallback(async () => {
        const fresh = await fetchSop<SopData>(sop.id);
        setSop(fresh);
        return fresh;
    }, [sop.id]);

    const handlePublish = async () => {
        setIsPublishing(true);
        setActionError(null);
        try {
            await publishSOP(sop.id);
            const fresh = await reload();
            if (fresh.approval_status !== 'approved') {
                setSaveMessage(`Published and sent to ${memberName(members.find(m => m.id === fresh.owner_id), 'your manager')} for approval.`);
            }
        } catch (err) {
            console.error('Failed to publish:', err);
            setActionError(err instanceof Error ? err.message : 'Failed to publish');
        } finally {
            setIsPublishing(false);
        }
    };

    useEffect(() => {
        if (!isViewer && !isTemplate) {
            loadSuggestions();
        }
    }, [sop.id, isViewer, isTemplate]);

    const loadSuggestions = async () => {
        const data = await getPendingSuggestions(sop.id);
        setSuggestions(data || []);
    };

    useEffect(() => {
        const base = editBase();
        setHasChanges(isEditing && (editedContent !== base.content || editedTitle !== base.title));
    }, [editedContent, editedTitle, isEditing, editBase]);

    const handlePrint = () => window.print();

    const handleSave = useCallback(async () => {
        if (!user || isTemplate) return;
        if (!hasChanges) return;

        setIsSaving(true);
        setSaveStatus('saving');
        setActionError(null);

        try {
            if (isViewer) {
                await suggestSOPEdit(sop.id, editedTitle, editedContent);
                setSaveStatus('saved');
                alert('Your edit suggestion has been submitted for review.');
            } else {
                // The database decides: owner/draft edits go live, others become a pending revision.
                await saveSopEdit(sop.id, editedTitle, editedContent);
                const fresh = await reload();
                if (!isDraft && fresh.pending_by === user.id && hasPendingRevision(fresh)) {
                    setSaveMessage(`Sent to ${memberName(members.find(m => m.id === fresh.owner_id), 'the owner')} for review. Everyone keeps seeing the approved version until it's approved.`);
                } else if (!isDraft) {
                    setSaveMessage(null);
                }
            }

            setHasChanges(false);
            if (!isViewer && !isDraft) setIsEditing(false);

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error('Save error:', error);
            setActionError(error instanceof Error ? error.message : 'Save failed');
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
        } finally {
            setIsSaving(false);
        }
    }, [user, isTemplate, hasChanges, sop.id, editedContent, editedTitle, isViewer, isDraft, reload, members]);

    // Autosave drafts only. Published edits are saved explicitly: each save of someone else's
    // SOP is a submission for review and is recorded in the audit trail.
    useEffect(() => {
        if (!hasChanges || isTemplate || isViewer || !isDraft) return;

        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(() => { handleSave(); }, 5000);

        return () => {
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        };
    }, [editedContent, editedTitle, hasChanges, isTemplate, isViewer, isDraft, handleSave]);

    const handleToggleEdit = () => {
        if (isEditing && hasChanges) {
            const confirmMsg = isViewer
                ? 'You have unsubmitted suggestions. Discard them?'
                : 'You have unsaved changes. Save them before leaving edit mode?';

            if (confirm(confirmMsg)) {
                if (!isViewer) handleSave();
            } else {
                return;
            }
        }

        if (!isEditing) {
            const base = editBase();
            setEditedTitle(base.title);
            setEditedContent(base.content);
            setShowPending(false);
        }

        setIsEditing(!isEditing);
    };

    const runReviewAction = async (fn: () => Promise<unknown>) => {
        setIsReviewing(true);
        setActionError(null);
        try {
            await fn();
            await reload();
            setShowPending(false);
            setShowChangesForm(false);
            setChangesNote('');
            setSaveMessage(null);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setIsReviewing(false);
        }
    };

    const handleResolveSuggestion = async (suggestionId: string, status: 'approved' | 'rejected') => {
        setIsSaving(true);
        try {
            await resolveSuggestion(suggestionId, status);
            await loadSuggestions();
            if (status === 'approved') {
                window.location.reload();
            }
        } catch (error) {
            console.error('Error resolving suggestion:', error);
            alert('Failed to resolve suggestion.');
        } finally {
            setIsSaving(false);
            setViewingSuggestionId(null);
        }
    };

    const companyName = profile?.company_name || team?.name || '';
    const companyLogo = profile?.company_logo_url || team?.logo_url || '';

    const activeSuggestion = suggestions.find(s => s.id === viewingSuggestionId);
    const displayContent = activeSuggestion
        ? activeSuggestion.suggested_content
        : isEditing ? editedContent
        : showPending && pendingRevision ? (sop.pending_content ?? sop.content)
        : sop.content;
    const displayTitle = isEditing ? editedTitle : showPending && pendingRevision ? (sop.pending_title ?? sop.title) : sop.title;
    const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

    const pageBg = overdue
        ? 'bg-gradient-to-br from-rose-100 via-red-100 to-rose-200 dark:bg-none dark:bg-[#1a0a0b]'
        : 'bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400 dark:bg-none dark:bg-[#09090b]';
    const articleBg = overdue
        ? 'bg-red-50 dark:bg-[#240d0f] border-red-200 dark:border-red-500/25'
        : 'bg-white dark:bg-[#121214] border-white/30 dark:border-white/5';

    return (
        <div className={`min-h-screen ${pageBg}`}>
            <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-white/20 dark:border-white/5 print:hidden">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        {isDraft && (
                            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300">
                                <GitPullRequestDraft className="w-3.5 h-3.5" />
                                Draft
                            </span>
                        )}
                        {unapproved && (
                            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                Not approved
                            </span>
                        )}
                        {overdue && (
                            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300">
                                Review overdue
                            </span>
                        )}

                        {saveStatus === 'saving' && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/50 animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#137fec]" />
                                {isViewer ? 'Submitting...' : 'Saving...'}
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="flex items-center gap-1.5 text-xs text-[#137fec] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isViewer ? 'Submitted' : 'Saved'}
                            </span>
                        )}
                        {hasChanges && saveStatus === 'idle' && (
                            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-bold">
                                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                Unsaved changes
                            </span>
                        )}

                        {(!activeSuggestion) && !isTemplate && (
                            <button
                                onClick={handleToggleEdit}
                                className={`p-2 rounded-xl flex items-center gap-2 px-4 transition-all text-sm font-bold ${isEditing
                                        ? 'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-lg'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'
                                    }`}
                            >
                                {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                <span>{isEditing ? 'View Mode' : (isViewer ? 'Suggest Edit' : 'Edit')}</span>
                            </button>
                        )}

                        {isEditing && hasChanges && !isTemplate && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-[#137fec] hover:bg-[#137fec]/90 text-white shadow-[#137fec]/20 shadow-lg py-2 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Processing...'
                                    : isViewer ? 'Submit Suggestion'
                                    : !isDraft && !isOwner && sop.approval_status === 'approved' ? 'Submit for review'
                                    : 'Save Changes'}
                            </button>
                        )}

                        {isDraft && !isEditing && !isViewer && !activeSuggestion && (
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="bg-green-500 hover:bg-green-600 text-white shadow-green-500/20 shadow-lg py-2 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {isPublishing ? 'Publishing...' : sop.owner_id && !isOwner ? 'Publish & submit for approval' : 'Publish SOP'}
                            </button>
                        )}

                        {!isEditing && !activeSuggestion && (
                            <>
                                <button
                                    onClick={() => setIsHistoryOpen(true)}
                                    className="p-2 text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white rounded-xl flex items-center gap-2 px-3 transition-colors"
                                >
                                    <History className="w-4 h-4" />
                                    <span className="text-sm font-bold">History</span>
                                </button>

                                {profile?.role === 'creator' && (
                                    <button
                                        onClick={handlePrint}
                                        className="p-2 text-gray-500 dark:text-white/50 hover:bg-[#137fec]/10 hover:text-[#137fec] rounded-xl flex items-center gap-2 px-3 transition-colors group"
                                    >
                                        <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        <span className="text-sm font-bold">Export PDF</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {suggestions.length > 0 && !isEditing && (
                <div className="bg-[#137fec]/10 border-b border-[#137fec]/20 print:hidden">
                    <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#137fec]/20 flex items-center justify-center text-[#137fec]">
                                <GitPullRequestDraft className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Pending Suggestions ({suggestions.length})</h4>
                                <p className="text-xs text-[#137fec]">Viewers have submitted edits for review</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {viewingSuggestionId ? (
                                <>
                                    <button
                                        onClick={() => handleResolveSuggestion(viewingSuggestionId, 'rejected')}
                                        disabled={isSaving}
                                        className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                        <XIcon className="w-3.5 h-3.5" /> Reject
                                    </button>
                                    <button
                                        onClick={() => handleResolveSuggestion(viewingSuggestionId, 'approved')}
                                        disabled={isSaving}
                                        className="px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Approve & Merge
                                    </button>
                                    <button
                                        onClick={() => setViewingSuggestionId(null)}
                                        className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-xs font-bold transition-all ml-4"
                                    >
                                        Cancel Review
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setViewingSuggestionId(suggestions[0].id)}
                                    className="px-4 py-2 bg-[#137fec] text-white rounded-lg text-xs font-bold hover:bg-[#137fec]/90 transition-all shadow-lg"
                                >
                                    Review Next
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Status banners: the SOP is always shown; these say how far to trust it. */}
            {!isTemplate && !activeSuggestion && (overdue || unapproved || pendingRevision || saveMessage || actionError) && (
                <div className="max-w-7xl mx-auto px-6 pt-6 space-y-3 print:hidden">
                    {actionError && (
                        <Banner tone="red" icon={<AlertTriangle className="w-5 h-5" />} title="That didn't work">{actionError}</Banner>
                    )}
                    {saveMessage && (
                        <Banner tone="blue" icon={<CheckCircle2 className="w-5 h-5" />} title={saveMessage} />
                    )}
                    {overdue && (
                        <Banner tone="red" icon={<CalendarX2 className="w-5 h-5" />}
                            title={`Review overdue since ${fmtDate(sop.next_review_at)}`}>
                            This procedure may be out of date. {isOwner
                                ? 'Check it is still correct, then use “Mark as Reviewed”.'
                                : `Check with ${ownerLabel} before relying on it.`}
                        </Banner>
                    )}
                    {unapproved && sop.approval_status === 'pending' && (
                        <Banner tone="amber" icon={<ShieldAlert className="w-5 h-5" />}
                            title="This procedure has not been approved yet">
                            {isOwner
                                ? 'You are the approver. Read it through, then approve it or request changes.'
                                : `Please speak to your line manager (${approverLabel}) before relying on it.`}
                        </Banner>
                    )}
                    {unapproved && sop.approval_status === 'changes_requested' && (
                        <Banner tone="amber" icon={<MessageSquareWarning className="w-5 h-5" />}
                            title={`Not approved: ${ownerLabel} has asked for changes`}>
                            {sop.review_note && <p className="italic">“{sop.review_note}”</p>}
                            {!isOwner && <p className="mt-1">Please speak to your line manager ({approverLabel}) before relying on it.</p>}
                        </Banner>
                    )}
                    {pendingRevision && !isOwner && (
                        <Banner tone="blue" icon={<FileClock className="w-5 h-5" />}
                            title={iAmPendingAuthor
                                ? `Your revision is waiting for review by ${ownerLabel}`
                                : `A revision by ${memberName(pendingAuthor)} is waiting for review by ${ownerLabel}`}>
                            You're viewing the currently approved version; keep following it until the revision is approved.
                            {iAmPendingAuthor && sop.review_note && (
                                <p className="mt-1 font-semibold">{ownerLabel} asked for changes: <span className="italic font-normal">“{sop.review_note}”</span></p>
                            )}
                        </Banner>
                    )}

                    {/* Owner's review controls */}
                    {isOwner && (pendingRevision || unapproved) && (
                        <div className="p-4 rounded-2xl border border-[#137fec]/30 bg-white dark:bg-[#121214] shadow-sm">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex-1 min-w-[200px]">
                                    <p className="font-bold text-sm text-gray-900 dark:text-white">
                                        {pendingRevision
                                            ? `${memberName(pendingAuthor)} submitted a revision${sop.pending_at ? ` on ${fmtDate(sop.pending_at)}` : ''}`
                                            : 'This SOP is waiting for your approval'}
                                    </p>
                                    {pendingRevision && (
                                        <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">
                                            {showPending ? 'Showing the proposed revision.' : 'Showing the approved version that is live now.'}
                                            {sop.review_note && ` You asked: “${sop.review_note}”`}
                                        </p>
                                    )}
                                </div>
                                {pendingRevision && (
                                    <button
                                        onClick={() => setShowPending(v => !v)}
                                        disabled={isEditing}
                                        className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white/70 text-xs font-bold hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-40"
                                    >
                                        {showPending ? 'Show approved version' : 'Show proposed revision'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowChangesForm(v => !v)}
                                    disabled={isReviewing}
                                    className="px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-500/20 disabled:opacity-40"
                                >
                                    Request changes
                                </button>
                                <button
                                    onClick={() => runReviewAction(() => approveSop(sop.id))}
                                    disabled={isReviewing || isEditing}
                                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40"
                                >
                                    {isReviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    {pendingRevision ? 'Approve revision' : 'Approve'}
                                </button>
                            </div>
                            {showChangesForm && (
                                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                    <textarea
                                        value={changesNote}
                                        onChange={e => setChangesNote(e.target.value)}
                                        rows={2}
                                        placeholder="What needs to change? This is shown to the author and kept in the audit trail."
                                        className="flex-1 p-3 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400/40"
                                    />
                                    <button
                                        onClick={() => runReviewAction(() => requestSopChanges(sop.id, changesNote))}
                                        disabled={isReviewing || !changesNote.trim()}
                                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold disabled:opacity-40 self-start sm:self-stretch"
                                    >
                                        Send
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="max-w-7xl mx-auto flex gap-8 p-6 print:p-0 print:block">
                <article className={`flex-1 ${articleBg} border rounded-3xl p-10 print:hidden relative overflow-hidden shadow-xl`}>
                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] ${overdue ? 'bg-red-400/10' : 'bg-[#137fec]/10'} blur-[100px] rounded-full pointer-events-none`} />

                    <div className="flex items-start justify-between mb-12 border-b border-gray-200 dark:border-white/10 pb-8 relative z-10">
                        <div>
                            {companyLogo ? (
                                <img src={companyLogo} alt={companyName} className="h-10 max-w-[200px] object-contain mb-4" />
                            ) : companyName ? (
                                <div className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">{companyName}</div>
                            ) : null}
                            <p className="text-[#137fec] text-xs uppercase tracking-widest font-black bg-[#137fec]/10 inline-block px-3 py-1 rounded-full border border-[#137fec]/20">
                                {activeSuggestion ? 'SUGGESTED EDIT PREVIEW'
                                    : showPending && pendingRevision ? 'PROPOSED REVISION (NOT LIVE)'
                                    : 'Standard Operating Procedure'}
                            </p>
                        </div>
                        <div className="text-right text-xs text-gray-400 dark:text-white/40 space-y-1.5 font-mono">
                            <div>ID: <span className="text-gray-700 dark:text-white/80">{sop.id.substring(0, 8)}</span></div>
                            {sop.version && <div>VER: <span className="text-[#137fec] bg-[#137fec]/10 px-1.5 rounded">v{sop.version}</span></div>}
                            <div>UPDATED: <span className="text-gray-700 dark:text-white/80">{new Date(sop.updated_at).toLocaleDateString()}</span></div>
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="mb-8 relative z-10">
                            <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                placeholder="SOP Title..."
                                className="w-full text-4xl font-black tracking-tight text-gray-900 dark:text-white bg-transparent border-0 border-b border-gray-200 dark:border-white/10 focus:border-[#137fec] focus:ring-0 px-0 pb-4 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-white/20"
                            />
                        </div>
                    ) : (
                        <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-8 relative z-10 break-words leading-tight">
                            {displayTitle}
                        </h1>
                    )}

                    {sop.tags && sop.tags.length > 0 && !isEditing && (
                        <div className="mb-10 flex flex-wrap gap-2 relative z-10">
                            {sop.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-[#137fec]/10 text-[#137fec] text-xs font-bold rounded-lg border border-[#137fec]/20">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="relative z-10">
                        {isEditing ? (
                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
                                {!isViewer && !isDraft && !isOwner && sop.approval_status === 'approved' && (
                                    <div className="p-3 bg-blue-50 dark:bg-[#137fec]/10 border-b border-blue-100 dark:border-[#137fec]/20 text-xs text-blue-900 dark:text-blue-100">
                                        Your changes go to <strong>{ownerLabel}</strong> for review. The approved version stays live until they approve.
                                        {pendingRevision && ' You are editing the revision that is already waiting for review.'}
                                    </div>
                                )}
                                <MarkdownEditor
                                    value={editedContent}
                                    onChange={setEditedContent}
                                />
                                {isViewer && (
                                    <div className="p-4 bg-[#137fec]/10 border-t border-[#137fec]/20 flex items-start gap-3">
                                        <ShieldAlert className="w-5 h-5 text-[#137fec] shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">Viewer Mode: Suggesting Edits</p>
                                            <p className="text-xs text-gray-600 dark:text-white/50">Your changes will be saved as a suggestion for the process owner to review.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="prose dark:prose-invert prose-blue max-w-none
                                prose-headings:font-black prose-headings:tracking-tight
                                prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8
                                prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-[#137fec]
                                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                                prose-p:leading-relaxed prose-p:mb-5
                                prose-li:leading-relaxed
                                prose-strong:font-bold
                                prose-hr:my-10
                                prose-code:text-[#137fec] prose-code:bg-[#137fec]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                                prose-pre:border prose-pre:rounded-xl
                                prose-blockquote:border-l-[#137fec] prose-blockquote:bg-[#137fec]/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-xl prose-blockquote:not-italic
                            ">
                                <ReactMarkdown {...sopMarkdownProps}>{displayContent}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </article>

                {!isEditing && !activeSuggestion && (
                    <aside className="w-80 shrink-0 space-y-6 print:hidden">
                        <OwnershipPanel
                            sop={sop}
                            members={members}
                            onChange={(updated) => setSop(prev => ({ ...prev, ...updated }))}
                            onError={setActionError}
                        />

                        <div className="bg-white dark:bg-[#121214] border border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#137fec]/5 blur-[40px] rounded-full" />

                            <div className="relative z-10 flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-gray-900 dark:text-white font-bold text-sm tracking-tight flex items-center gap-2">
                                        <LinkIcon className="w-4 h-4 text-[#137fec]" />
                                        Process Dependencies
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-white/40 mt-1">SOPs linked to this document</p>
                                </div>
                            </div>

                            {sop.related_sop_ids && sop.related_sop_ids.length > 0 ? (
                                <div className="space-y-2 mb-4">
                                    <p className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-widest">{sop.related_sop_ids.length} Linked Items</p>
                                </div>
                            ) : (
                                <div className="py-4 text-center text-xs text-gray-400 dark:text-white/30 italic bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 mb-4">
                                    No dependencies linked yet.
                                </div>
                            )}

                            {profile?.role === 'creator' && (
                                <button
                                    onClick={() => setShowLinkPicker(true)}
                                    className="w-full py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white rounded-xl text-xs font-bold transition-all border border-gray-100 dark:border-white/5 flex items-center justify-center gap-2"
                                >
                                    <LinkIcon className="w-3.5 h-3.5" />
                                    Manage Links
                                </button>
                            )}
                        </div>
                    </aside>
                )}
            </div>

            <SOPHistoryPanel
                sopId={sop.id}
                sopTitle={sop.title}
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                currentRole={profile?.role as 'creator' | 'viewer'}
                onViewVersion={(record) => {
                    setEditedContent(record.content);
                    setEditedTitle(record.title);
                    setIsEditing(false);
                    alert(`Viewing historical version: ${record.version}`);
                }}
                onRestoreVersion={async (record) => {
                    if (!confirm(`Restore Version ${record.version}? ${isOwner || sop.approval_status !== 'approved'
                        ? 'It will become the live version.'
                        : `It will be sent to ${ownerLabel} for review first.`}`)) return;
                    try {
                        await saveSopEdit(sop.id, record.title, record.content, { summary: `Restored from v${record.version}`, restore: true });
                        await reload();
                    } catch (error) {
                        console.error('Rollback error:', error);
                        setActionError(error instanceof Error ? error.message : 'Restore failed');
                    }
                }}
            />

            {/* SOPLinkPicker renders its own modal chrome, including backdrop and close control. */}
            <SOPLinkPicker
                sopId={sop.id}
                currentRelatedIds={sop.related_sop_ids || []}
                isOpen={showLinkPicker}
                onClose={() => setShowLinkPicker(false)}
                onUpdate={(newIds) => {
                    setSop(prev => ({ ...prev, related_sop_ids: newIds }));
                }}
            />

            <PDFRenderer
                title={sop.title}
                content={sop.content}
                companyName={companyName}
                companyLogoUrl={companyLogo}
                version={sop.version}
                updatedAt={sop.updated_at}
                tags={sop.tags}
                notApproved={unapproved}
                reviewOverdueSince={overdue ? sop.next_review_at : null}
            />
        </div>
    );
}
