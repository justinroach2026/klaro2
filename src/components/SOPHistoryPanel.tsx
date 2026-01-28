import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Clock, ArrowLeft, History } from 'lucide-react';

interface HistoryRecord {
    id: string;
    version: number;
    title: string;
    content: string;
    change_summary: string | null;
    created_at: string;
    created_by: string | null;
}

interface SOPHistoryPanelProps {
    sopId: string;
    isOpen: boolean;
    onClose: () => void;
    onRollback: (record: HistoryRecord) => void;
}

export default function SOPHistoryPanel({ sopId, isOpen, onClose, onRollback }: SOPHistoryPanelProps) {
    const [history, setHistory] = useState<HistoryRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen, sopId]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase!
                .from('sop_history')
                .select('*')
                .eq('sop_id', sopId)
                .order('version', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-primary">
                        <History className="w-6 h-6" />
                        <h2 className="text-xl font-heading font-bold text-text">Version History</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-text-lighter" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-text-lighter">
                            <Clock className="w-8 h-8 animate-pulse mb-2" />
                            <p>Loading history...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-text-lighter space-y-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                <Clock className="w-8 h-8 opacity-20" />
                            </div>
                            <p>No previous versions found.<br />Every edit creates a new snapshot.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {history.map((record) => (
                                <div key={record.id} className="relative pl-6 border-l-2 border-primary/10 pb-2">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-primary rounded-full" />

                                    <div className="bg-background-alt/50 rounded-2xl p-4 hover:bg-background-alt transition-colors group">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded uppercase">
                                                Version {record.version}
                                            </span>
                                            <span className="text-[10px] font-bold text-text-lighter flex items-center gap-1 uppercase">
                                                <Clock className="w-3 h-3" />
                                                {new Date(record.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <h4 className="font-bold text-text mb-2">{record.title}</h4>
                                        {record.change_summary && (
                                            <p className="text-xs text-text-light mb-4 line-clamp-3 italic">
                                                "{record.change_summary}"
                                            </p>
                                        )}

                                        <button
                                            onClick={() => onRollback(record)}
                                            className="text-[10px] font-black text-primary hover:underline flex items-center gap-1 uppercase tracking-widest"
                                        >
                                            <ArrowLeft className="w-3 h-3" />
                                            Rollback to this version
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 text-[10px] text-text-lighter uppercase tracking-widest font-bold text-center">
                    ISO 9001 Compliant Audit Trail
                </div>
            </div>
        </div>
    );
}
