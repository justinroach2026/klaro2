import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../../store';
import { supabase, suggestSOPEdit, getPendingSuggestions, resolveSuggestion, publishSOP } from '../../lib/supabase';
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
    Link as LinkIcon
} from 'lucide-react';

type SopData = {
    id: string;
    title: string;
    content: string;
    language: string;
    updated_at: string;
    created_at: string;
    tags?: string[];
    version?: number;
    profiles?: { full_name: string };
    owner_id?: string | null;
    review_interval_days?: number | null;
    last_reviewed_at?: string | null;
    next_review_at?: string | null;
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
            .select('*, profiles(full_name)')
            .eq('id', id)
            .single()
            .then(({ data, error }) => {
                if (error || !data) { navigate('/dashboard'); return; }
                setSopData(data);
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

function SOPViewerContent({ initialSop, onBack }: { initialSop: SopData; onBack: () => void }) {
    const { team, profile, user } = useStore();
    const [sop, setSop] = useState(initialSop);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(sop.content);
    const [editedTitle, setEditedTitle] = useState(sop.title);

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasChanges, setHasChanges] = useState(false);

    const [showLinkPicker, setShowLinkPicker] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [viewingSuggestionId, setViewingSuggestionId] = useState<string | null>(null);

    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTemplate = sop.id.startsWith('template-');
    const isViewer = profile?.role === 'viewer';
    const [isDraft, setIsDraft] = useState(sop.status === 'draft');
    const [isPublishing, setIsPublishing] = useState(false);

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            await publishSOP(sop.id);
            setIsDraft(false);
            setSop(prev => ({ ...prev, status: 'published' }));
        } catch (err) {
            console.error('Failed to publish:', err);
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
        setHasChanges(editedContent !== sop.content || editedTitle !== sop.title);
    }, [editedContent, editedTitle, sop.content, sop.title]);

    useEffect(() => {
        if (!hasChanges || isTemplate || isViewer) return;

        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

        autosaveTimerRef.current = setTimeout(() => {
            handleSave();
        }, 5000);

        return () => {
            if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        };
    }, [editedContent, editedTitle, hasChanges, isTemplate, isViewer]);

    const handlePrint = () => window.print();

    const handleSave = useCallback(async () => {
        if (!user || isTemplate) return;
        if (!hasChanges && saveStatus !== 'idle') return;

        setIsSaving(true);
        setSaveStatus('saving');

        try {
            if (isViewer) {
                await suggestSOPEdit(sop.id, editedTitle, editedContent);
                setSaveStatus('saved');
                alert('Your edit suggestion has been submitted for review.');
            } else {
                const nextVersion = (sop.version || 1) + 1;

                await supabase!
                    .from('sop_history')
                    .insert({
                        sop_id: sop.id,
                        version: sop.version || 1,
                        title: sop.title,
                        content: sop.content,
                        tags: sop.tags || [],
                        change_summary: 'Manual edit',
                        created_by: user.id
                    });

                const { error } = await supabase!
                    .from('sops')
                    .update({
                        title: editedTitle,
                        content: editedContent,
                        version: nextVersion,
                        change_summary: 'Manual edit via rich text editor',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', sop.id);

                if (error) throw error;

                setSop(prev => ({
                    ...prev,
                    content: editedContent,
                    title: editedTitle,
                    version: nextVersion,
                    updated_at: new Date().toISOString()
                }));
            }

            setHasChanges(false);
            if (!isViewer) setIsEditing(false);

            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error('Save error:', error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
        } finally {
            setIsSaving(false);
        }
    }, [user, isTemplate, hasChanges, saveStatus, sop, editedContent, editedTitle, isViewer]);

    const handleToggleEdit = () => {
        if (isEditing && hasChanges) {
            const confirmMsg = isViewer
                ? 'You have unsubmitted suggestions. Discard them?'
                : 'You have unsaved changes. Save before leaving edit mode?';

            if (confirm(confirmMsg)) {
                if (!isViewer) handleSave();
            } else {
                return;
            }
        }

        if (isEditing && isViewer) {
            setEditedContent(sop.content);
            setEditedTitle(sop.title);
        }

        setIsEditing(!isEditing);
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
    const displayContent = activeSuggestion ? activeSuggestion.suggested_content : (isEditing ? editedContent : sop.content);
    const displayTitle = isEditing ? editedTitle : sop.title;

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-400 dark:bg-none dark:bg-[#09090b]">
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

                        {saveStatus === 'saving' && (
                            <span className="flex items-center gap-1.5 text-xs text-white/50 animate-pulse">
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
                            <span className="flex items-center gap-1.5 text-xs text-amber-500 font-bold">
                                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                Unsaved changes
                            </span>
                        )}

                        {(!activeSuggestion) && (
                            <button
                                onClick={handleToggleEdit}
                                className={`p-2 rounded-xl flex items-center gap-2 px-4 transition-all text-sm font-bold ${isEditing
                                        ? 'bg-white text-black hover:bg-white/90 shadow-lg'
                                        : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                                    }`}
                            >
                                {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                                <span>{isEditing ? 'View Mode' : (isViewer ? 'Suggest Edit' : 'Edit Mode')}</span>
                            </button>
                        )}

                        {isEditing && hasChanges && !isTemplate && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-[#137fec] hover:bg-[#137fec]/90 text-white shadow-[#137fec]/20 shadow-lg py-2 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Processing...' : (isViewer ? 'Submit Suggestion' : 'Save Changes')}
                            </button>
                        )}

                        {isDraft && !isEditing && !isViewer && !activeSuggestion && (
                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="bg-green-500 hover:bg-green-600 text-white shadow-green-500/20 shadow-lg py-2 px-4 rounded-xl text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                {isPublishing ? 'Publishing...' : 'Publish SOP'}
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
                                <h4 className="text-sm font-bold text-white">Pending Suggestions ({suggestions.length})</h4>
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
                                        className="px-3 py-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Approve & Merge
                                    </button>
                                    <button
                                        onClick={() => setViewingSuggestionId(null)}
                                        className="px-3 py-1.5 bg-white/5 text-white/70 hover:bg-white/10 rounded-lg text-xs font-bold transition-all ml-4"
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

            <div className="max-w-7xl mx-auto flex gap-8 p-6 print:p-0 print:block">
                <article className="flex-1 bg-white dark:bg-[#121214] border border-white/30 dark:border-white/5 rounded-3xl p-10 print:hidden relative overflow-hidden shadow-xl">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#137fec]/10 blur-[100px] rounded-full pointer-events-none" />

                    <div className="flex items-start justify-between mb-12 border-b border-white/10 pb-8 relative z-10">
                        <div>
                            {companyLogo ? (
                                <img src={companyLogo} alt={companyName} className="h-10 max-w-[200px] object-contain mb-4" />
                            ) : companyName ? (
                                <div className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">{companyName}</div>
                            ) : null}
                            <p className="text-[#137fec] text-xs uppercase tracking-widest font-black bg-[#137fec]/10 inline-block px-3 py-1 rounded-full border border-[#137fec]/20">
                                {activeSuggestion ? 'SUGGESTED EDIT PREVIEW' : 'Standard Operating Procedure'}
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
                                className="w-full text-4xl font-black tracking-tight text-white bg-transparent border-0 border-b border-white/10 focus:border-[#137fec] focus:ring-0 px-0 pb-4 outline-none transition-all placeholder:text-white/20"
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
                            <div className="rounded-2xl border border-white/10 overflow-hidden bg-black/20">
                                <MarkdownEditor
                                    value={editedContent}
                                    onChange={setEditedContent}
                                />
                                {isViewer && (
                                    <div className="p-4 bg-[#137fec]/10 border-t border-[#137fec]/20 flex items-start gap-3">
                                        <ShieldAlert className="w-5 h-5 text-[#137fec] shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-white mb-1">Viewer Mode: Suggesting Edits</p>
                                            <p className="text-xs text-white/50">Your changes will be saved as a suggestion for the process owner to review.</p>
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
                                <ReactMarkdown>{displayContent}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </article>

                {!isEditing && !activeSuggestion && (
                    <aside className="w-80 shrink-0 space-y-6 print:hidden">
                        <OwnershipPanel
                            sopId={sop.id}
                            ownerId={sop.owner_id ?? null}
                            reviewIntervalDays={sop.review_interval_days ?? null}
                            lastReviewedAt={sop.last_reviewed_at ?? null}
                            nextReviewAt={sop.next_review_at ?? null}
                        />

                        <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#137fec]/5 blur-[40px] rounded-full" />

                            <div className="relative z-10 flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-white font-bold text-sm tracking-tight flex items-center gap-2">
                                        <LinkIcon className="w-4 h-4 text-[#137fec]" />
                                        Process Dependencies
                                    </h3>
                                    <p className="text-xs text-white/40 mt-1">SOPs linked to this document</p>
                                </div>
                            </div>

                            {sop.related_sop_ids && sop.related_sop_ids.length > 0 ? (
                                <div className="space-y-2 mb-4">
                                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{sop.related_sop_ids.length} Linked Items</p>
                                </div>
                            ) : (
                                <div className="py-4 text-center text-xs text-white/30 italic bg-white/5 rounded-xl border border-white/5 mb-4">
                                    No dependencies linked yet.
                                </div>
                            )}

                            {profile?.role === 'creator' && (
                                <button
                                    onClick={() => setShowLinkPicker(true)}
                                    className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5 flex items-center justify-center gap-2"
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
                    if (confirm(`Restore Version ${record.version}? This will become the new active version.`)) {
                        try {
                            const nextVersion = (sop.version || 1) + 1;

                            await supabase!
                                .from('sop_history')
                                .insert({
                                    sop_id: sop.id,
                                    version: sop.version || 1,
                                    title: sop.title,
                                    content: sop.content,
                                    tags: sop.tags || [],
                                    change_summary: `Rollback to v${record.version}`,
                                    created_by: user?.id
                                });

                            const { error } = await supabase!
                                .from('sops')
                                .update({
                                    title: record.title,
                                    content: record.content,
                                    version: nextVersion,
                                    change_summary: `Restored from v${record.version}`
                                })
                                .eq('id', sop.id);

                            if (error) throw error;
                            window.location.reload();
                        } catch (error) {
                            console.error('Rollback error:', error);
                        }
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
                content={displayContent}
                companyName={companyName}
                companyLogoUrl={companyLogo}
                version={sop.version}
                updatedAt={sop.updated_at}
                tags={sop.tags}
            />
        </div>
    );
}
