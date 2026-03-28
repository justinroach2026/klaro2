import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store';
import { supabase, suggestSOPEdit, getPendingEditSuggestions, resolveEditSuggestion } from '../lib/supabase';
import SOPHistoryPanel from '../components/SOPHistoryPanel';
import MarkdownEditor from '../components/MarkdownEditor';
import OwnershipPanel from '../components/OwnershipPanel';
import SOPLinkPicker from '../components/SOPLinkPicker';
import PDFRenderer from '../components/PDFRenderer';
import {
    Download,
    ChevronLeft,
    Printer,
    Calendar,
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

interface SOPViewerProps {
    sop: {
        id: string;
        title: string;
        content: string;
        language: string;
        updated_at: string;
        created_at: string;
        tags?: string[];
        version?: number;
        profiles?: {
            full_name: string;
        };
        owner_id?: string | null;
        review_interval_days?: number | null;
        last_reviewed_at?: string | null;
        next_review_at?: string | null;
        related_sop_ids?: string[] | null;
    };
    onBack: () => void;
}

export default function SOPViewer({ sop: initialSop, onBack }: SOPViewerProps) {
    const { team, profile, user } = useStore();
    const [sop, setSop] = useState(initialSop);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(sop.content);
    const [editedTitle, setEditedTitle] = useState(sop.title);
    
    // Status Trackers
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasChanges, setHasChanges] = useState(false);
    
    // Phase 2 State
    const [showLinkPicker, setShowLinkPicker] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [viewingSuggestionId, setViewingSuggestionId] = useState<string | null>(null);

    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTemplate = sop.id.startsWith('template-');
    const isViewer = profile?.role === 'viewer';
    const isOwner = sop.owner_id === user?.id;

    // Load pending suggestions if user is creator
    useEffect(() => {
        if (!isViewer && !isTemplate) {
            loadSuggestions();
        }
    }, [sop.id, isViewer, isTemplate]);

    const loadSuggestions = async () => {
        const data = await getPendingEditSuggestions(sop.id);
        setSuggestions(data || []);
    };

    // Track changes
    useEffect(() => {
        const contentChanged = editedContent !== sop.content;
        const titleChanged = editedTitle !== sop.title;
        setHasChanges(contentChanged || titleChanged);
    }, [editedContent, editedTitle, sop.content, sop.title]);

    // Autosave after 5 seconds of inactivity (only for creators and non-templates)
    useEffect(() => {
        if (!hasChanges || isTemplate || isViewer) return;

        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
        }

        autosaveTimerRef.current = setTimeout(() => {
            handleSave();
        }, 5000);

        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
        };
    }, [editedContent, editedTitle, hasChanges, isTemplate, isViewer]);

    const handlePrint = () => {
        window.print();
    };

    const handleSave = useCallback(async () => {
        if (!user || isTemplate) return;
        if (!hasChanges && saveStatus !== 'idle') return;

        setIsSaving(true);
        setSaveStatus('saving');

        try {
            if (isViewer) {
                // Viewers Suggest Edits instead of saving directly
                await suggestSOPEdit(sop.id, editedContent, 'Suggested update via Viewer edit');
                setSaveStatus('saved');
                alert('Your edit suggestion has been submitted for review.');
            } else {
                // Creators save directly to main SOP
                const nextVersion = (sop.version || 1) + 1;

                // 1. Snapshot current version to history
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

                // 2. Update the SOP with new content
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
            if (!isViewer) setIsEditing(false); // auto close edit mode for creators after explicit save
            
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
                return; // User cancelled
            }
        }
        
        // Reset content to original if closing without saving
        if (isEditing && isViewer) {
             setEditedContent(sop.content);
             setEditedTitle(sop.title);
        }
        
        setIsEditing(!isEditing);
    };

    const handleResolveSuggestion = async (suggestionId: string, status: 'approved' | 'rejected') => {
        setIsSaving(true);
        try {
            await resolveEditSuggestion(suggestionId, status);
            await loadSuggestions();
            if (status === 'approved') {
                // If approved, trigger a full reload to get the new content/version from DB
                // In a real app we'd fetch the new SOP data, but this works for now
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

    // If currently viewing a suggestion instead of live content
    const activeSuggestion = suggestions.find(s => s.id === viewingSuggestionId);
    const displayContent = activeSuggestion ? activeSuggestion.suggested_content : (isEditing ? editedContent : sop.content);
    const displayTitle = isEditing ? editedTitle : sop.title;

    return (
        <div className="min-h-screen bg-[#09090b]">
            {/* Toolbar */}
            <div className="sticky top-0 z-40 bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 print:hidden">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center text-white/50 hover:text-white font-medium transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        Back to Dashboard
                    </button>

                    <div className="flex items-center gap-3">
                        {/* Status Messages */}
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

                        {/* Edit Mode Toggle */}
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

                        {/* Save/Suggest Button (only in edit mode with changes) */}
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

                        {/* Read-Only Actions */}
                        {!isEditing && !activeSuggestion && (
                            <>
                                <button
                                    onClick={() => setIsHistoryOpen(true)}
                                    className="p-2 text-white/50 hover:bg-white/5 hover:text-white rounded-xl flex items-center gap-2 px-3 transition-colors"
                                >
                                    <History className="w-4 h-4" />
                                    <span className="text-sm font-bold">History</span>
                                </button>
                                
                                {profile?.role === 'creator' && (
                                    <button
                                        onClick={handlePrint}
                                        className="p-2 text-white/50 hover:bg-[#137fec]/10 hover:text-[#137fec] rounded-xl flex items-center gap-2 px-3 transition-colors group"
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

            {/* Suggestions Banner (Creators Only) */}
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

            {/* Main Layout */}
            <div className="max-w-7xl mx-auto flex gap-8 p-6 print:p-0 print:block">
                
                {/* Left Column: Document */}
                <article className="flex-1 bg-[#121214] border border-white/5 rounded-3xl p-10 print:hidden relative overflow-hidden">
                    {/* Glowing effect top center */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#137fec]/10 blur-[100px] rounded-full pointer-events-none" />

                    {/* Meta Header */}
                    <div className="flex items-start justify-between mb-12 border-b border-white/10 pb-8 relative z-10">
                        <div>
                            {companyLogo ? (
                                <img src={companyLogo} alt={companyName} className="h-10 max-w-[200px] object-contain mb-4" />
                            ) : companyName ? (
                                <div className="text-xl font-black text-white mb-2 tracking-tight">
                                    {companyName}
                                </div>
                            ) : null}
                            <p className="text-[#137fec] text-xs uppercase tracking-widest font-black bg-[#137fec]/10 inline-block px-3 py-1 rounded-full border border-[#137fec]/20">
                                {activeSuggestion ? 'SUGGESTED EDIT PREVIEW' : 'Standard Operating Procedure'}
                            </p>
                        </div>
                        <div className="text-right text-xs text-white/40 space-y-1.5 font-mono">
                            <div>ID: <span className="text-white/80">{sop.id.substring(0, 8)}</span></div>
                            {sop.version && <div>VER: <span className="text-[#137fec] bg-[#137fec]/10 px-1.5 rounded">v{sop.version}</span></div>}
                            <div>UPDATED: <span className="text-white/80">{new Date(sop.updated_at).toLocaleDateString()}</span></div>
                        </div>
                    </div>

                    {/* Title editor / display */}
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
                        <h1 className="text-4xl font-black tracking-tight text-white mb-8 relative z-10 break-words leading-tight">
                            {displayTitle}
                        </h1>
                    )}

                    {/* Tags */}
                    {sop.tags && sop.tags.length > 0 && !isEditing && (
                        <div className="mb-10 flex flex-wrap gap-2 relative z-10">
                            {sop.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-white/5 text-white/60 text-xs font-bold rounded-lg border border-white/10">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Content Area */}
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
                                            <p className="text-xs text-white/50">Your changes will be saved as a suggestion for the process owner to review. They will not go live immediately.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="prose prose-invert prose-blue max-w-none 
                                prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white
                                prose-h1:text-3xl prose-h1:mb-6 prose-h1:mt-8
                                prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-[#137fec]
                                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                                prose-p:text-white/70 prose-p:leading-relaxed prose-p:mb-5
                                prose-li:text-white/70 prose-li:leading-relaxed
                                prose-strong:text-white prose-strong:font-bold
                                prose-hr:border-white/10 prose-hr:my-10
                                prose-code:text-[#137fec] prose-code:bg-[#137fec]/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                                prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl
                                prose-blockquote:border-l-[#137fec] prose-blockquote:bg-[#137fec]/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:text-white/80
                            ">
                                <ReactMarkdown>{displayContent}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </article>

                {/* Right Column: Process Integrity Sidebar */}
                {!isEditing && !activeSuggestion && (
                    <aside className="w-80 shrink-0 space-y-6 print:hidden">
                        <OwnershipPanel
                            sopId={sop.id}
                            initialOwnerId={sop.owner_id}
                            initialIntervalDays={sop.review_interval_days}
                            lastReviewedAt={sop.last_reviewed_at}
                            nextReviewAt={sop.next_review_at}
                            currentRole={profile?.role as 'creator' | 'viewer'}
                            onUpdate={(ownerId, intervalDays) => {
                                setSop(prev => ({
                                    ...prev,
                                    owner_id: ownerId,
                                    review_interval_days: intervalDays
                                }));
                            }}
                        />

                        {/* Dependencies Panel */}
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
                                    {/* Ideally we'd map and load the titles, but for now we just show count/managed view */}
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

            {/* Overlays & Print Rendering */}
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

            {showLinkPicker && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLinkPicker(false)} />
                    <div className="relative w-full max-w-md h-full bg-[#121214] border-l border-white/10 animate-slide-in-right">
                        <div className="h-full flex flex-col p-6">
                            <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/5">
                                <div>
                                    <h2 className="text-lg font-black text-white">Manage Links</h2>
                                    <p className="text-xs text-white/40">Connect related documentation</p>
                                </div>
                                <button onClick={() => setShowLinkPicker(false)} className="p-2 text-white/30 hover:bg-white/5 hover:text-white rounded-xl transition-all">
                                    <XIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <SOPLinkPicker
                                currentSopId={sop.id}
                                selectedSopIds={sop.related_sop_ids || []}
                                onChange={async (newIds) => {
                                    setSop(prev => ({ ...prev, related_sop_ids: newIds }));
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden PDF Wrapper for Print Mode */}
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
