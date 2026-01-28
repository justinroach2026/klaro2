import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '../store';
import { supabase } from '../lib/supabase';
import SOPHistoryPanel from '../components/SOPHistoryPanel';
import {
    Download,
    ChevronLeft,
    Printer,
    Calendar,
    History
} from 'lucide-react';

interface SOPViewerProps {
    sop: {
        id: string;
        title: string;
        content: string;
        language: string;
        updated_at: string;
        tags?: string[];
        version?: number;
    };
    onBack: () => void;
}

export default function SOPViewer({ sop, onBack }: SOPViewerProps) {
    const { team } = useStore();
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const handlePrint = () => {
        window.print();
    };

    const handleOpenHistory = () => {
        setIsHistoryOpen(true);
    };

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
                    </div>
                </div>
            </div>

            {/* SOP Content */}
            <article className="max-w-4xl mx-auto px-6 py-12 print:py-0">
                {/* Branding Header */}
                <div className="flex items-center justify-between mb-12 border-b-2 border-primary/10 pb-8">
                    <div>
                        {team?.logo_url ? (
                            <img src={team.logo_url} alt={team.name} className="h-12 mb-4" />
                        ) : (
                            <div className="text-2xl font-heading font-black text-primary mb-2 italic tracking-tighter">
                                KLARO<span className="text-text">DOCUMENTATION</span>
                            </div>
                        )}
                        <p className="text-text-lighter text-sm uppercase tracking-widest font-bold">
                            Standard Operating Procedure
                        </p>
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
                            <span className="font-bold">Last Updated:</span> {new Date(sop.updated_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>

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

                {/* Markdown Content */}
                <div className="prose prose-blue max-w-none 
                    prose-headings:font-heading prose-headings:font-bold prose-headings:text-text
                    prose-h1:text-5xl prose-h1:mb-12 prose-h1:text-primary
                    prose-h2:text-2xl prose-h2:mt-16 prose-h2:mb-6 prose-h2:flex prose-h2:items-center prose-h2:gap-3
                    prose-h2:before:content-[''] prose-h2:before:w-1 prose-h2:before:h-8 prose-h2:before:bg-primary prose-h2:before:rounded-full
                    prose-p:text-text-light prose-p:leading-relaxed prose-p:text-lg
                    prose-li:text-text-light prose-li:text-lg
                    prose-strong:text-text prose-strong:font-bold
                    prose-hr:my-12 prose-hr:border-gray-100
                ">
                    <ReactMarkdown>{sop.content}</ReactMarkdown>
                </div>

                {/* Approval Signature (Enterprise Ready) */}
                <div className="mt-24 p-8 border-2 border-dashed border-gray-100 rounded-3xl grid grid-cols-2 gap-8 print:border-solid">
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-text-lighter uppercase tracking-widest">Prepared By</p>
                        <div className="h-12 border-b border-gray-200"></div>
                        <p className="text-sm text-text-light">AI Documentation Specialist</p>
                    </div>
                    <div className="space-y-4">
                        <p className="text-xs font-bold text-text-lighter uppercase tracking-widest">Approved By</p>
                        <div className="h-12 border-b border-gray-200"></div>
                        <p className="text-sm text-text-light">Process Owner</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-20 pt-8 border-t border-gray-100 text-center text-xs text-text-lighter italic">
                    This document was professionally generated by Klaro 2 AI. {team?.name && `Property of ${team.name}.`}
                    <br />
                    Confidential business documentation. Internal use only.
                </div>
            </article>

            {/* History Panel */}
            <SOPHistoryPanel
                sopId={sop.id}
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                onRollback={async (record) => {
                    if (confirm(`Rollback to Version ${record.version}? This will create a new current version.`)) {
                        try {
                            const { user } = useStore.getState();
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
