import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import SOPHistoryPanel from '../components/SOPHistoryPanel';
import MarkdownEditor from '../components/MarkdownEditor';
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
    Loader2
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
    };
    onBack: () => void;
}

export default function SOPViewer({ sop, onBack }: SOPViewerProps) {
    const { team, profile, user } = useStore();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(sop.content);
    const [editedTitle, setEditedTitle] = useState(sop.title);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [hasChanges, setHasChanges] = useState(false);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isTemplate = sop.id.startsWith('template-');

    // Track changes
    useEffect(() => {
        const contentChanged = editedContent !== sop.content;
        const titleChanged = editedTitle !== sop.title;
        setHasChanges(contentChanged || titleChanged);
    }, [editedContent, editedTitle, sop.content, sop.title]);

    // Autosave after 5 seconds of inactivity (only for non-template SOPs)
    useEffect(() => {
        if (!hasChanges || isTemplate) return;

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
    }, [editedContent, editedTitle, hasChanges, isTemplate]);

    const handlePrint = () => {
        window.print();
    };

    const handleOpenHistory = () => {
        setIsHistoryOpen(true);
    };

    const handleSave = useCallback(async () => {
        if (!user || isTemplate) return;
        if (!hasChanges && saveStatus !== 'idle') return;

        setIsSaving(true);
        setSaveStatus('saving');

        try {
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
                    change_summary: 'Manual edit via rich text editor'
                })
                .eq('id', sop.id);

            if (error) throw error;

            // Update the sop object in place so subsequent saves don't re-snapshot
            sop.content = editedContent;
            sop.title = editedTitle;
            sop.version = nextVersion;
            sop.updated_at = new Date().toISOString();

            setSaveStatus('saved');
            setHasChanges(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error('Save error:', error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
        } finally {
            setIsSaving(false);
        }
    }, [user, isTemplate, hasChanges, saveStatus, sop, editedContent, editedTitle]);

    const handleToggleEdit = () => {
        if (isEditing && hasChanges) {
            // If leaving edit mode with unsaved changes, prompt
            const confirmLeave = confirm('You have unsaved changes. Save before leaving edit mode?');
            if (confirmLeave) {
                handleSave();
            }
        }
        setIsEditing(!isEditing);
    };

    const companyName = profile?.company_name || team?.name || '';
    const companyLogo = profile?.company_logo_url || team?.logo_url || '';

    return (
        <div className="min-h-screen bg-white">
            {/* Toolbar */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 print:hidden">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center text-text-light hover:text-text font-medium"
                    >
                        <ChevronLeft className="w-5 h-5 mr-1" />
                        Back
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Save status indicator */}
                        {saveStatus === 'saving' && (
                            <span className="flex items-center gap-1.5 text-xs text-text-lighter animate-pulse">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving…
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Saved
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                                Save failed
                            </span>
                        )}
                        {hasChanges && saveStatus === 'idle' && (
                            <span className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                Unsaved changes
                            </span>
                        )}

                        {/* Edit toggle */}
                        <button
                            onClick={handleToggleEdit}
                            className={`p-2 rounded-lg flex items-center gap-2 px-3 transition-colors text-sm font-medium ${isEditing
                                    ? 'bg-primary text-white'
                                    : 'text-text-light hover:bg-gray-100'
                                }`}
                        >
                            {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                            <span>{isEditing ? 'View' : 'Edit'}</span>
                        </button>

                        {/* Save button (only in edit mode with changes) */}
                        {isEditing && hasChanges && !isTemplate && (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving…' : 'Save'}
                            </button>
                        )}

                        {!isEditing && (
                            <>
                                <button
                                    onClick={handleOpenHistory}
                                    className="p-2 text-text-light hover:bg-gray-100 rounded-lg flex items-center gap-2 px-3 transition-colors"
                                >
                                    <History className="w-4 h-4" />
                                    <span className="text-sm">History</span>
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="p-2 text-text-light hover:bg-gray-100 rounded-lg flex items-center gap-2 px-3 transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span className="text-sm">Print</span>
                                </button>
                                <button className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
                                    <Download className="w-4 h-4" />
                                    Export PDF
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* SOP Content */}
            <article className="max-w-4xl mx-auto px-6 py-12 print:py-0">
                {/* Company Branding Header */}
                <div className="flex items-start justify-between mb-12 border-b-2 border-primary/10 pb-8">
                    <div>
                        {companyLogo ? (
                            <img src={companyLogo} alt={companyName} className="h-14 max-w-[220px] object-contain mb-3" />
                        ) : companyName ? (
                            <div className="text-2xl font-heading font-black text-primary mb-2 tracking-tight">
                                {companyName}
                            </div>
                        ) : (
                            <div className="text-2xl font-heading font-black text-primary mb-2 italic tracking-tighter">
                                KLARO<span className="text-text">DOCUMENTATION</span>
                            </div>
                        )}
                        <p className="text-text-lighter text-sm uppercase tracking-widest font-bold">
                            Standard Operating Procedure
                        </p>
                        {profile?.company_website && (
                            <p className="text-xs text-primary/70 mt-1">{profile.company_website}</p>
                        )}
                    </div>
                    <div className="text-right text-xs text-text-lighter space-y-1">
                        <div className="flex items-center justify-end gap-2">
                            <span className="font-bold">Doc ID:</span> #{sop.id.substring(0, 8).toUpperCase()}
                        </div>
                        {sop.version && (
                            <div className="flex items-center justify-end gap-2">
                                <span className="font-bold">Version:</span>
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-black">V{sop.version}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                            <span className="font-bold">Language:</span> {sop.language.toUpperCase()}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <span className="font-bold">Status:</span>
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <Calendar className="w-3 h-3" />
                            <span className="font-bold">Created:</span> {new Date(sop.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <span className="font-bold">Last Updated:</span> {new Date(sop.updated_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>

                {/* Editable Title */}
                {isEditing ? (
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-text-lighter uppercase tracking-wider mb-2">Document Title</label>
                        <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            className="w-full text-3xl font-heading font-bold text-text border border-gray-200 rounded-xl p-4 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        />
                    </div>
                ) : null}

                {/* Metadata Tags */}
                {sop.tags && sop.tags.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-2">
                        {sop.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-primary/5 text-primary text-xs font-bold rounded-full border border-primary/10">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Content: Editor or Markdown Render */}
                {isEditing ? (
                    <div className="print:hidden">
                        <MarkdownEditor
                            value={editedContent}
                            onChange={setEditedContent}
                        />
                        {isTemplate && (
                            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                <strong>📝 Template Preview:</strong> This is a template document. To save edits, first create this SOP through the interview process — the content will then be editable and saved to your account.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="prose prose-blue max-w-none 
                        prose-headings:font-heading prose-headings:font-bold prose-headings:text-text
                        prose-h1:text-4xl prose-h1:mb-8 prose-h1:mt-4 prose-h1:text-primary
                        prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-6 prose-h2:flex prose-h2:items-center prose-h2:gap-3
                        prose-h2:before:content-[''] prose-h2:before:w-1 prose-h2:before:h-8 prose-h2:before:bg-primary prose-h2:before:rounded-full
                        prose-h3:text-lg prose-h3:mt-10 prose-h3:mb-4 prose-h3:text-text
                        prose-p:text-text-light prose-p:leading-relaxed prose-p:text-base prose-p:mb-4
                        prose-li:text-text-light prose-li:text-base prose-li:leading-relaxed prose-li:mb-1
                        prose-ul:my-4 prose-ul:pl-2
                        prose-ol:my-4 prose-ol:pl-2
                        prose-strong:text-text prose-strong:font-bold
                        prose-hr:my-12 prose-hr:border-gray-100
                        prose-table:border-collapse prose-table:w-full prose-table:my-6
                        prose-th:bg-primary/5 prose-th:text-text prose-th:font-bold prose-th:text-sm prose-th:p-3 prose-th:text-left prose-th:border prose-th:border-gray-200
                        prose-td:p-3 prose-td:text-sm prose-td:border prose-td:border-gray-200 prose-td:text-text-light
                        [&_ul_ul]:mt-1 [&_ul_ul]:mb-0
                        [&_li>p]:mb-1
                        [&_input[type=checkbox]]:mr-2
                    ">
                        <ReactMarkdown>{editedContent}</ReactMarkdown>
                    </div>
                )}

                {/* Approval Signature */}
                {!isEditing && (
                    <div className="mt-24 p-8 border-2 border-dashed border-gray-100 rounded-3xl grid grid-cols-2 gap-8 print:border-solid">
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-text-lighter uppercase tracking-widest">Prepared By</p>
                            <div className="h-12 border-b border-gray-200 flex items-end pb-2">
                                <span className="font-handwriting text-2xl text-primary/80">
                                    {sop.profiles?.full_name || 'AI Documentation Specialist'}
                                </span>
                            </div>
                            <p className="text-sm text-text-light">{sop.profiles?.full_name || 'AI Assistant'}</p>
                        </div>
                        <div className="space-y-4">
                            <p className="text-xs font-bold text-text-lighter uppercase tracking-widest">Approved By</p>
                            <div className="h-12 border-b border-gray-200"></div>
                            <p className="text-sm text-text-light">Process Owner</p>
                        </div>
                    </div>
                )}

                {/* Footer with Company Info */}
                {!isEditing && (
                    <div className="mt-20 pt-8 border-t border-gray-100 text-center text-xs text-text-lighter space-y-2">
                        <p className="italic">
                            This document was professionally generated by Klaro 2 AI.
                            {companyName && ` Property of ${companyName}.`}
                        </p>
                        {(profile?.company_email || profile?.company_phone || profile?.company_address) && (
                            <div className="flex flex-wrap items-center justify-center gap-3 text-text-lighter/70">
                                {profile.company_email && <span>✉ {profile.company_email}</span>}
                                {profile.company_phone && <span>📞 {profile.company_phone}</span>}
                                {profile.company_address && <span>📍 {profile.company_address}</span>}
                            </div>
                        )}
                        <p>Confidential business documentation. Internal use only.</p>
                    </div>
                )}
            </article>

            {/* History Panel */}
            <SOPHistoryPanel
                sopId={sop.id}
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                onRollback={async (record) => {
                    if (confirm(`Rollback to Version ${record.version}? This will create a new current version.`)) {
                        try {
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
                                    change_summary: `Rollback to v${record.version}`,
                                    created_by: user?.id
                                });

                            // 2. Update current version
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

                            alert('Rollback successful!');
                            window.location.reload();
                        } catch (error) {
                            console.error('Rollback error:', error);
                            alert('Failed to rollback.');
                        }
                    }
                }}
            />
        </div>
    );
}
